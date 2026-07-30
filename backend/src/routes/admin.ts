import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '../middleware/auth';

const router = Router();
const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

// Enforce admin check for all routes in this file
router.use(verifyAdmin);

// 1. GET /api/admin/metrics
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    // Total Active Users
    const { count: userCount, error: userError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_banned', false);

    // Total Credits Consumed
    const { data: consumedData, error: consumedError } = await supabase
      .from('credit_ledger')
      .select('amount')
      .eq('type', 'DEDUCTION');
    const totalCreditsConsumed = consumedData?.reduce((acc, curr) => acc + curr.amount, 0) || 0;

    // Total Revenue (Stripe)
    const { data: revenueData, error: revenueError } = await supabase
      .from('credit_ledger')
      .select('amount')
      .eq('type', 'PURCHASE');
    // Assuming 100 credits = $10 ($0.10 per credit)
    const totalRevenue = (revenueData?.reduce((acc, curr) => acc + curr.amount, 0) || 0) * 0.10;

    // GPU Job Failure Rate (Simplified)
    const { data: sceneData, error: sceneError } = await supabase
      .from('scenes')
      .select('status');
    const totalScenes = sceneData?.length || 0;
    const failedScenes = sceneData?.filter(s => s.status === 'FAILED').length || 0;
    const failureRate = totalScenes > 0 ? ((failedScenes / totalScenes) * 100).toFixed(2) + '%' : '0%';

    res.status(200).json({
      activeUsers: userCount || 0,
      creditsConsumed: totalCreditsConsumed,
      totalRevenue,
      failureRate
    });
  } catch (error: any) {
    console.error('Metrics aggregation error:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// 2. POST /api/admin/user/:id/credits
router.post('/user/:id/credits', async (req: Request, res: Response) => {
  const adminId = (req as any).adminId;
  const targetUserId = req.params.id;
  const { amount } = req.body;

  if (typeof amount !== 'number') {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  try {
    const { error } = await supabase.rpc('admin_adjust_credits', {
      p_admin_id: adminId,
      p_target_user_id: targetUserId,
      p_amount: amount
    });

    if (error) throw error;
    res.status(200).json({ success: true, message: 'Wallet adjusted successfully' });
  } catch (error: any) {
    console.error('Credit adjustment error:', error);
    res.status(500).json({ error: error.message || 'Failed to adjust credits' });
  }
});

// 3. POST /api/admin/user/:id/ban
router.post('/user/:id/ban', async (req: Request, res: Response) => {
  const targetUserId = req.params.id;
  const { is_banned } = req.body;

  try {
    const { error } = await supabase
      .from('users')
      .update({ is_banned })
      .eq('id', targetUserId);

    if (error) throw error;
    res.status(200).json({ success: true, message: `User ban status updated to ${is_banned}` });
  } catch (error: any) {
    console.error('Ban action error:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// 4. POST /api/admin/community/:id/moderate
router.post('/community/:id/moderate', async (req: Request, res: Response) => {
  const projectId = req.params.id;
  const { is_public } = req.body;

  try {
    const { error } = await supabase
      .from('projects')
      .update({ is_public })
      .eq('id', projectId);

    if (error) throw error;
    res.status(200).json({ success: true, message: `Project visibility updated to ${is_public}` });
  } catch (error: any) {
    console.error('Moderation error:', error);
    res.status(500).json({ error: 'Failed to update project visibility' });
  }
});

// 5. GET /api/admin/generation-logs
router.get('/generation-logs', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('generation_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    res.status(200).json(data);
  } catch (error: any) {
    console.error('Fetch generation logs error:', error);
    res.status(500).json({ error: 'Failed to fetch generation logs' });
  }
});

export default router;
