import { Router, Request, Response } from 'express';
import Stripe from 'stripe';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' as any });

router.post('/', async (req: Request, res: Response) => {
  const { user_id, tier, creditsAmount } = req.body;

  if (!user_id || !tier || !creditsAmount) {
    return res.status(400).json({ error: 'Missing required checkout parameters' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `PromptVerse ${tier === 'production' ? '4K Production' : 'Standard'} Credits`,
              description: `Top up your wallet with ${creditsAmount} credits.`,
            },
            unit_amount: 1000, // $10.00 placeholder per package
          },
          quantity: 1,
        },
      ],
      metadata: {
        user_id,
        tier,
        credits: creditsAmount.toString(),
      },
      success_url: `${process.env.BASE_URL || 'http://localhost:3000'}/explore?success=true`,
      cancel_url: `${process.env.BASE_URL || 'http://localhost:3000'}/explore?canceled=true`,
    });

    res.status(200).json({ url: session.url });
  } catch (error: any) {
    console.error('Failed to create Stripe checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

export default router;
