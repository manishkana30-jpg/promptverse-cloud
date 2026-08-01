import { Router, Request, Response } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { AppError } from '../utils/errorHandler';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const router = Router();
const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

const key_id = process.env.RAZORPAY_KEY_ID;
const key_secret = process.env.RAZORPAY_KEY_SECRET;

if (!key_id || !key_secret) {
  console.error("⚠️ CRITICAL: Razorpay API keys are missing in backend/.env!");
}

const razorpay = new Razorpay({
  key_id: key_id || 'placeholder_key',
  key_secret: key_secret || 'placeholder_secret'
});

// Tiers Mapping (Credits -> Amount in INR)
// Adjusted for best online pricing with ~5-10% profit margin
const TIER_MAPPING: Record<string, { credits: number, amount_inr: number }> = {
  starter: { credits: 100, amount_inr: 249 },
  creator: { credits: 500, amount_inr: 999 }, // Popular tier
  studio: { credits: 1500, amount_inr: 2499 } // High volume tier
};

router.post('/razorpay/create-order', async (req: Request, res: Response) => {
  const { user_id, tier } = req.body;

  if (!user_id || !tier || !TIER_MAPPING[tier]) {
    return res.status(400).json({ error: 'Invalid user or tier' });
  }

  const { credits, amount_inr } = TIER_MAPPING[tier];

  try {
    // Razorpay receipt limit is 40 characters
    const shortReceipt = `rcpt_${Date.now().toString().slice(-8)}_${Math.floor(Math.random()*1000)}`;
    const options = {
      amount: amount_inr * 100, // Razorpay takes amount in paise (smallest currency unit)
      currency: "INR",
      receipt: shortReceipt
    };

    const order = await razorpay.orders.create(options);
    
    return res.status(200).json({
      success: true,
      order_id: order.id,
      amount: options.amount,
      currency: options.currency,
      credits
    });
  } catch (error: any) {
    console.error("Razorpay order creation failed:", error);
    const err = new AppError('Failed to create payment order', 'PAYMENT_CREATION_FAILED', 500);
    return res.status(500).json(err.toJSON());
  }
});

router.post('/razorpay/verify', async (req: Request, res: Response) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, user_id } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !user_id) {
    return res.status(400).json({ error: 'Missing required fields for verification' });
  }

  const secret = process.env.RAZORPAY_KEY_SECRET || '';

  // 1. Verify the signature
  const generatedSignature = crypto
    .createHmac('sha256', secret)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest('hex');

  if (generatedSignature !== razorpay_signature) {
    console.error(`Invalid signature. Expected: ${generatedSignature}, Received: ${razorpay_signature}`);
    return res.status(400).json({ error: 'Payment verification failed: Invalid signature' });
  }

  // 2. Fetch actual payment amount from Razorpay
  let verifiedCredits = 0;
  try {
    const payment = await razorpay.payments.fetch(razorpay_payment_id);
    if (payment.status !== 'captured') {
      return res.status(400).json({ error: 'Payment not successful' });
    }

    const amountPaid = payment.amount; // in paise
    const tier = Object.values(TIER_MAPPING).find(t => t.amount_inr * 100 === amountPaid);
    if (!tier) {
      console.error(`Invalid payment amount: ${amountPaid}`);
      return res.status(400).json({ error: 'Invalid payment amount mapping' });
    }
    
    verifiedCredits = tier.credits;
  } catch (fetchError: any) {
    console.error('Failed to fetch Razorpay payment details:', fetchError);
    return res.status(500).json({ error: 'Failed to verify payment details with Razorpay' });
  }

  // 3. Fund the wallet
  try {
    const { error: walletError } = await supabase.rpc('add_purchased_credits', {
      p_user_id: user_id,
      p_amount: verifiedCredits,
      p_session_id: razorpay_payment_id // Using payment ID as idempotency lock
    });

    if (walletError) {
      if (walletError.code === '23505') {
        console.log(`Payment ${razorpay_payment_id} already processed. Ignoring.`);
        return res.json({ success: true, message: 'Payment already verified' });
      }
      throw walletError;
    }

    return res.status(200).json({ success: true, message: 'Payment verified and credits added' });
  } catch (error: any) {
    console.error('Failed to fund wallet after Razorpay payment:', error);
    return res.status(500).json({ error: 'Failed to update wallet balance' });
  }
});

export default router;
