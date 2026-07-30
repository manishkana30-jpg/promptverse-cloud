import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { broadcastToUser } from '../utils/sse';
import crypto from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error("⚠️ CRITICAL: Supabase URL or Key is missing in backend/.env!");
}

const supabase = createClient(supabaseUrl, supabaseKey);
const router = Router();

// Helper to verify Replicate Webhook (HMAC SHA-256)
function verifyReplicateSignature(req: Request): boolean {
  const signature = req.headers['webhook-signature'] as string;
  const webhookId = req.headers['webhook-id'] as string;
  const webhookTimestamp = req.headers['webhook-timestamp'] as string;
  const secret = process.env.REPLICATE_WEBHOOK_SECRET;

  if (!signature || !webhookId || !webhookTimestamp || !secret) return false;

  // CRITICAL FIX: Replay Attack Prevention
  // Check if timestamp is within a 5-minute tolerance
  const timestampMs = parseInt(webhookTimestamp, 10) * 1000;
  if (Date.now() - timestampMs > 5 * 60 * 1000) {
    console.error('Webhook timestamp is too old (Replay Attack Prevention)');
    return false;
  }

  // Ensure body is a Buffer before toString
  if (!Buffer.isBuffer(req.body)) {
    console.error('Webhook body is not a raw buffer');
    return false;
  }

  const signedContent = `${webhookId}.${webhookTimestamp}.${req.body.toString('utf8')}`;
  const secretBytes = Buffer.from(secret.split('_')[1], 'base64');
  const expectedSignature = crypto
    .createHmac('sha256', secretBytes)
    .update(signedContent)
    .digest('base64');

  const signatures = signature.split(' ');
  return signatures.some(sig => sig.split(',')[1] === expectedSignature);
}

// Helper to verify Fal Webhook
function verifyFalSignature(req: Request): boolean {
  const signature = req.headers['x-fal-signature'];
  if (!signature) return false;
  
  if (!Buffer.isBuffer(req.body)) {
    console.error('Webhook body is not a raw buffer');
    return false;
  }
  // In a real app, verify against Fal's JWKS or shared secret here
  return true;
}

// Handler for Webhook Success/Failure
async function handleWebhookResult(scene_id: string, status: string, video_url?: string) {
  // CRITICAL FIX: Webhook Idempotency Check
  const { data: currentScene } = await supabase
    .from('scenes')
    .select('status, projects!inner(user_id)')
    .eq('id', scene_id)
    .single();

  if (!currentScene) return;
  const userId = (currentScene.projects as any).user_id;

  if (currentScene.status === 'COMPLETED' || currentScene.status === 'FAILED') {
    console.log(`Skipping webhook for scene ${scene_id} - already in terminal state: ${currentScene.status}`);
    return;
  }

  if (status === 'COMPLETED' && video_url) {
    await supabase.from('scenes').update({ status: 'COMPLETED', video_url }).eq('id', scene_id);
    broadcastToUser(userId, 'VIDEO_READY', { scene_id, video_url });
  } else {
    await supabase.from('scenes').update({ status: 'FAILED' }).eq('id', scene_id);
    await supabase.rpc('refund_scene_credits', { p_user_id: userId, p_scene_id: scene_id });
    broadcastToUser(userId, 'VIDEO_FAILED', { scene_id });
  }
}

// POST /api/webhooks/replicate
router.post('/replicate', async (req: Request, res: Response) => {
  if (!verifyReplicateSignature(req)) {
    return res.status(401).json({ error: 'Invalid Replicate signature or expired payload' });
  }

  try {
    const rawBody = req.body.toString('utf8');
    const payload = JSON.parse(rawBody);
    const scene_id = req.query.scene_id as string;
    
    if (!scene_id) return res.status(400).json({ error: 'Missing scene_id' });

    const status = payload.status === 'succeeded' ? 'COMPLETED' : 'FAILED';
    const video_url = payload.output ? payload.output[0] : null;

    await handleWebhookResult(scene_id, status, video_url);
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Replicate webhook error:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// POST /api/webhooks/fal
router.post('/fal', async (req: Request, res: Response) => {
  if (!verifyFalSignature(req)) {
    return res.status(401).json({ error: 'Invalid Fal signature' });
  }

  try {
    const rawBody = req.body.toString('utf8');
    const payload = JSON.parse(rawBody);
    const scene_id = req.query.scene_id as string;
    
    if (!scene_id) return res.status(400).json({ error: 'Missing scene_id' });

    const status = payload.status === 'OK' ? 'COMPLETED' : 'FAILED';
    const video_url = payload.payload?.video?.url;

    await handleWebhookResult(scene_id, status, video_url);
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Fal webhook error:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' as any });

// POST /api/webhooks/stripe
router.post('/stripe', async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return res.status(400).json({ error: 'Missing signature or webhook secret' });
  }

  let event: Stripe.Event;

  try {
    // req.body is already a Buffer here because of express.raw in app.ts
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    
    const userId = session.metadata?.user_id;
    const creditsAmount = parseInt(session.metadata?.credits || '0', 10);

    if (userId && creditsAmount > 0) {
      try {
        // Increment wallet and log transaction atomically (now with idempotency via session.id)
        const { error: walletError } = await supabase.rpc('add_purchased_credits', {
          p_user_id: userId,
          p_amount: creditsAmount,
          p_session_id: session.id
        });

        if (walletError) {
          // If the error is a unique constraint violation, it means we already processed this session.
          // In that case, we can safely ignore it and return 200 so Stripe stops retrying.
          if (walletError.code === '23505') { // Postgres unique_violation error code
            console.log(`Session ${session.id} already processed. Ignoring duplicate webhook.`);
            return res.json({ received: true, duplicate: true });
          }
          throw walletError;
        }

        console.log(`Successfully topped up ${creditsAmount} credits for user ${userId}`);
      } catch (err: any) {
        console.error('Failed to update wallet after successful checkout', err);
        return res.status(500).json({ error: `Database error during credit fulfillment: ${err.message || 'Unknown error'}` });
      }
    }
  }

  return res.json({ received: true });
});

export default router;
