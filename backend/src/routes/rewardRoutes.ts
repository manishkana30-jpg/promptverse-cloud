import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();
const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

// Data Labeling: Rate a generation to earn credits (5 ratings = 5 credits)
router.post('/data-labeling', async (req: Request, res: Response) => {
  const { user_id, scene_id, rating } = req.body;

  if (!user_id || !scene_id || !rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Invalid input fields' });
  }

  try {
    const { data, error } = await supabase.rpc('submit_scene_rating', {
      p_user_id: user_id,
      p_scene_id: scene_id,
      p_rating: rating
    });

    if (error) {
      if (error.code === '23505') { // unique_violation
        return res.status(400).json({ error: 'You have already rated this scene' });
      }
      throw error;
    }

    return res.status(200).json(data);
  } catch (err: any) {
    console.error('Data labeling error:', err);
    return res.status(500).json({ error: 'Failed to submit rating' });
  }
});

// Social Share: Grant 20 credits for sharing a watermarked video
router.post('/social-share', async (req: Request, res: Response) => {
  const { user_id, video_id, platform } = req.body;

  if (!user_id || !video_id || !platform) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // SECURITY FIX: Validate the video belongs to the user and actually exists
    const { data: scene, error: sceneErr } = await supabase
      .from('scenes')
      .select('id')
      .eq('id', video_id)
      .eq('user_id', user_id)
      .single();

    if (sceneErr || !scene) {
      return res.status(403).json({ error: 'Invalid video or unauthorized' });
    }

    const { error } = await supabase.rpc('add_reward_credits', {
      p_user_id: user_id,
      p_amount: 20,
      p_action_type: 'social_share',
      p_reference_id: video_id // Idempotency lock
    });

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'You have already claimed a reward for sharing this video' });
      }
      throw error;
    }

    return res.status(200).json({ success: true, message: '+20 Credits Earned!' });
  } catch (err: any) {
    console.error('Social share reward error:', err);
    return res.status(500).json({ error: 'Failed to claim social share reward' });
  }
});

// Apply a referral code to earn 50 credits (for both)
router.post('/apply-referral', async (req: Request, res: Response) => {
  const { user_id, referral_code } = req.body;

  if (!user_id || !referral_code) {
    return res.status(400).json({ error: 'Missing user_id or referral_code' });
  }

  try {
    // Find the referral code owner
    const { data: refOwner, error: refError } = await supabase
      .from('referral_codes')
      .select('user_id')
      .eq('code', referral_code)
      .single();

    if (refError || !refOwner) {
      return res.status(400).json({ error: 'Invalid referral code' });
    }

    const inviter_id = refOwner.user_id;

    if (inviter_id === user_id) {
      return res.status(400).json({ error: 'You cannot use your own referral code' });
    }

    // Give 50 credits to the invitee
    const { error: inviteeError } = await supabase.rpc('add_reward_credits', {
      p_user_id: user_id,
      p_amount: 50,
      p_action_type: 'referral_bonus_invitee',
      p_reference_id: 'has_been_invited' // Idempotency: guarantees a user can only ever apply one referral code
    });

    if (inviteeError) {
      if (inviteeError.code === '23505') {
        return res.status(400).json({ error: 'You have already used a referral code' });
      }
      throw inviteeError;
    }

    // Give 50 credits to the inviter
    const { error: inviterError } = await supabase.rpc('add_reward_credits', {
      p_user_id: inviter_id,
      p_amount: 50,
      p_action_type: 'referral_bonus_inviter',
      p_reference_id: user_id // Idempotency: inviter_id + user_id + 'referral_bonus_inviter'
    });

    if (inviterError) {
      console.warn(`Failed to reward inviter ${inviter_id}: ${inviterError.message}`);
      // Not failing the request since invitee succeeded
    }

    return res.status(200).json({ success: true, message: '+50 Credits Earned!' });
  } catch (err: any) {
    console.error('Referral application error:', err);
    return res.status(500).json({ error: 'Failed to process referral code' });
  }
});

export default router;
