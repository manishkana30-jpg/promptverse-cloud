import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';

const router = Router();
const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

// Rate limiting for like/view endpoints to prevent spamming
const interactionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 interaction requests per `window`
  message: { error: 'Too many interaction requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/community/feed
router.get('/feed', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const sort = req.query.sort as string === 'trending' ? 'likes_count' : 'created_at';

    const { data: projects, error, count } = await supabase
      .from('projects')
      .select('id, title, views_count, likes_count, final_video_url, created_at', { count: 'exact' })
      .eq('is_public', true)
      .not('final_video_url', 'is', null)
      .order(sort, { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error({ err: error.message }, 'Failed to fetch community feed');
      return res.status(500).json({ error: 'Failed to fetch feed' });
    }

    return res.status(200).json({
      projects,
      total: count,
      page,
      limit,
      totalPages: count ? Math.ceil(count / limit) : 0,
    });
  } catch (error: any) {
    logger.error({ err: error.message }, 'Community feed route error');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/community/:id/view
router.post('/:id/view', interactionLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Increment view count via RPC
    const { error } = await supabase.rpc('increment_project_views', { p_project_id: id });
    
    if (error) {
      logger.error({ err: error.message, project_id: id }, 'Failed to increment view');
      return res.status(400).json({ error: 'Failed to record view' });
    }
    
    return res.status(200).json({ success: true });
  } catch (error: any) {
    logger.error({ err: error.message }, 'Community view route error');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/community/:id/like
router.post('/:id/like', interactionLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Increment like count via RPC
    const { error } = await supabase.rpc('increment_project_likes', { p_project_id: id });
    
    if (error) {
      logger.error({ err: error.message, project_id: id }, 'Failed to increment like');
      return res.status(400).json({ error: 'Failed to record like' });
    }
    
    return res.status(200).json({ success: true });
  } catch (error: any) {
    logger.error({ err: error.message }, 'Community like route error');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
