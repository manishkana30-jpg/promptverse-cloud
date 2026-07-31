import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import * as fal from '@fal-ai/serverless-client';
import Replicate from 'replicate';
import { broadcastToUser } from '../utils/sse';
import { logger, logMLOpsEvent } from '../utils/logger';
import { AppError } from '../utils/errorHandler';

const router = Router();
const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

const BASE_URL = process.env.BASE_URL || 'https://promptverse-cloud.onrender.com';

router.post('/', async (req: Request, res: Response) => {
  const { user_id, scene_id, prompt, tier } = req.body;

  if (!user_id || !scene_id || !prompt || !tier) {
    const err = new AppError('Missing required fields', 'INVALID_REQUEST', 400);
    return res.status(400).json(err.toJSON());
  }

  const traceId = req.headers['x-trace-id'] as string || 'unknown-trace';
  const cost = tier === 'draft' ? 5 : 25;

  try {
    // 1. Deduct Credits atomically via RPC
    const { error: deductError } = await supabase.rpc('deduct_scene_credits', {
      p_user_id: user_id,
      p_cost: cost,
      p_scene_id: scene_id
    });

    if (deductError) {
      logger.error({ trace_id: traceId, err: deductError.message || deductError }, 'Credit deduction failed for regeneration');
      const err = new AppError('Your wallet balance is empty or insufficient.', 'INSUFFICIENT_FUNDS', 402, 'Please add credits to continue generating.', '/billing');
      return res.status(402).json(err.toJSON());
    }

    // Input Validation: Reject malicious or empty prompts
    if (prompt.trim().length < 5 || prompt.length > 2000) {
      await supabase.rpc('refund_scene_credits', { p_user_id: user_id, p_scene_id: scene_id });
      const err = new AppError('Invalid prompt length', 'INVALID_PROMPT', 400, 'Please provide a prompt between 5 and 2000 characters.');
      return res.status(400).json(err.toJSON());
    }

    // 2. Archive old scene state and update prompt/version atomically
    const { data: newVersion, error: archiveError } = await supabase.rpc('archive_scene_and_increment_version', {
      p_scene_id: scene_id,
      p_new_prompt: prompt,
      p_status: 'GENERATING'
    });

    if (archiveError) {
      logger.error({ trace_id: traceId, err: archiveError.message }, 'Failed to archive scene');
      await supabase.rpc('refund_scene_credits', { p_user_id: user_id, p_scene_id: scene_id });
      const err = new AppError('Failed to archive previous scene version', 'ARCHIVE_FAILED', 500);
      return res.status(500).json(err.toJSON());
    }

    // 3. Dispatch to External APIs
    const startTime = Date.now();

    if (tier === 'draft') {
      await fal.queue.submit('fal-ai/ltx-video', {
        input: { prompt },
        webhookUrl: `${BASE_URL}/api/webhooks/fal?scene_id=${scene_id}&trace_id=${traceId}`
      });
    } else {
      await replicate.predictions.create({
        model: "minimax/video-01", // Placeholder
        input: { prompt },
        webhook: `${BASE_URL}/api/webhooks/replicate?scene_id=${scene_id}&trace_id=${traceId}`,
        webhook_events_filter: ["completed"]
      });
    }

    // Log the MLOps Event
    logMLOpsEvent('MODEL_INVOCATION', {
      trace_id: traceId,
      user_id,
      scene_id,
      model: tier === 'draft' ? 'fal-ai/ltx-video' : 'replicate/premium',
      tier,
      cost,
      latency_ms: Date.now() - startTime,
      prompt: `[REDACTED] - Length: ${prompt.length}`,
      is_regeneration: true
    });

    // Notify UI via SSE
    broadcastToUser(user_id, 'SCENE_STATUS_UPDATE', { scene_id, status: 'GENERATING' });

    return res.status(200).json({ success: true, message: 'Regeneration dispatched', new_version: newVersion });
  } catch (error: any) {
    logger.error({ trace_id: traceId, err: error.message || error }, 'Regeneration dispatch error');
    // Refund on catastrophic error
    await supabase.rpc('refund_scene_credits', { p_user_id: user_id, p_scene_id: scene_id });
    // Reset status to FAILED to prevent perpetual loading on frontend
    await supabase.from('scenes').update({ status: 'FAILED' }).eq('id', scene_id);
    broadcastToUser(user_id, 'SCENE_STATUS_UPDATE', { scene_id, status: 'FAILED' });
    const err = new AppError('Failed to dispatch regeneration', 'DISPATCH_FAILED', 500);
    return res.status(500).json(err.toJSON());
  }
});

export default router;
