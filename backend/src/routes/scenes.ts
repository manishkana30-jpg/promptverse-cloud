import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { AppError } from '../utils/errorHandler';
import { stitchVideoWorker } from '../worker/ffmpeg';

const router = Router();
const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

router.post('/stitch-movie', async (req: Request, res: Response) => {
  const { project_id, scene_ids } = req.body;

  if (!project_id || !scene_ids || !Array.isArray(scene_ids)) {
    const err = new AppError('Invalid request. project_id and ordered scene_ids array required.', 'BAD_REQUEST', 400);
    return res.status(400).json(err.toJSON());
  }

  try {
    // Insert into stitch_jobs
    const { data: job, error } = await supabase
      .from('stitch_jobs')
      .insert({
        project_id,
        ordered_scene_ids: scene_ids,
        status: 'pending'
      })
      .select()
      .single();

    if (error || !job) {
      throw new AppError('Failed to create stitch job', 'DATABASE_ERROR', 500);
    }

    // Dispatch background worker
    stitchVideoWorker(job.id, project_id, scene_ids);

    return res.status(200).json({ success: true, job_id: job.id, status: 'pending' });
  } catch (error: any) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json(error.toJSON());
    }
    const err = new AppError('Internal server error', 'SERVER_ERROR', 500);
    return res.status(500).json(err.toJSON());
  }
});

export default router;
