import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { Zap, Loader2, CheckCircle2, ShieldCheck, CreditCard } from 'lucide-react';
import { ActionableErrorToast, type ActionableError } from '../components/ActionableErrorToast';

declare global {
  interface Window {
    Razorpay: any;
  }
}

const TIER_MAPPING = [
  { id: 'starter', name: 'Starter', credits: 100, amount_inr: 249, description: 'Perfect for testing and small projects.' },
  { id: 'creator', name: 'Creator', credits: 500, amount_inr: 999, description: 'Best for active creators making regular videos.', popular: true },
  { id: 'studio', name: 'Studio', credits: 1500, amount_inr: 2499, description: 'For power users and professional studios.' }
];

export const BillingPage: React.FC = () => {
  const { user } = useAuthStore();
  const [error, setError] = useState<ActionableError | null>(null);
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Load Razorpay Script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const handlePurchase = async (tierId: string) => {
    if (!user) {
      setError({ code: 'UNAUTHORIZED', message: 'You must be logged in to purchase credits.' });
      return;
    }

    if (!window.Razorpay) {
      setError({ code: 'SCRIPT_ERROR', message: 'Razorpay SDK failed to load. Please check your connection or disable adblockers.' });
      return;
    }

    setLoadingTier(tierId);
    setError(null);
    setSuccess(false);

    try {
      // 1. Create Order on Backend
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/pay/razorpay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, tier: tierId })
      });

      const orderData = await res.json();
      if (!res.ok) throw new Error(orderData.error?.message || orderData.error || 'Failed to create order');

      // 2. Initialize Razorpay Checkout
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_placeholder', 
        amount: orderData.amount,
        currency: orderData.currency,
        name: "PromptVerse Cloud AI",
        description: `${tierId.toUpperCase()} Package - ${orderData.credits} Credits`,
        order_id: orderData.order_id,
        handler: async function (response: any) {
          try {
            // 3. Verify Payment on Backend
            const verifyRes = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/pay/razorpay/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                user_id: user.id
              })
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error || 'Payment verification failed');

            setSuccess(true);
            
            // Reload user profile to fetch updated credits
            useAuthStore.getState().initializeAuth();
            
          } catch (verifyErr: any) {
            setError({ code: 'VERIFICATION_FAILED', message: verifyErr.message });
          }
        },
        prefill: {
          email: user.email || ''
        },
        theme: {
          color: "#00f0ff" // Neon Blue matching the app
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        setError({ code: 'PAYMENT_FAILED', message: response.error.description });
      });
      rzp.open();

    } catch (err: any) {
      setError({ code: 'CHECKOUT_ERROR', message: err.message });
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto min-h-screen">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-black mb-4 tracking-tight">
          Supercharge Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-blue to-neon-purple">Creativity</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          Purchase credits to generate stunning AI videos, characters, and scenes. 
          Credits never expire.
        </p>
      </div>

      {success && (
        <div className="mb-12 bg-green-500/10 border border-green-500/50 rounded-xl p-6 flex items-center justify-center gap-4 animate-fadeIn">
          <div className="bg-green-500/20 p-3 rounded-full">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
          <div>
            <h3 className="text-green-400 font-bold text-xl">Payment Successful!</h3>
            <p className="text-green-400/80">Your credits have been added to your wallet. You can now continue generating.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {TIER_MAPPING.map((tier) => (
          <div 
            key={tier.id}
            className={`
              relative bg-gray-900 rounded-2xl p-8 border transition-all duration-300 hover:-translate-y-2
              ${tier.popular 
                ? 'border-neon-purple shadow-[0_0_30px_rgba(188,19,254,0.15)] scale-105 z-10' 
                : 'border-gray-800 hover:border-gray-700 hover:shadow-xl'}
            `}
          >
            {tier.popular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-neon-blue to-neon-purple text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                Most Popular
              </div>
            )}
            
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-bold text-white mb-2">{tier.name}</h3>
                <p className="text-gray-400 text-sm h-10">{tier.description}</p>
              </div>
              <div className="bg-dark-bg p-3 rounded-xl border border-gray-800">
                <Zap className={`w-6 h-6 ${tier.popular ? 'text-neon-purple' : 'text-neon-blue'}`} />
              </div>
            </div>

            <div className="mb-8">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black text-white">₹{(tier.amount_inr).toLocaleString()}</span>
                <span className="text-gray-500 font-medium">INR</span>
              </div>
              <div className="mt-4 inline-flex items-center gap-2 bg-white/5 px-4 py-2 rounded-lg border border-white/10">
                <ShieldCheck className="w-4 h-4 text-green-400" />
                <span className="text-white font-bold">{tier.credits} Credits</span>
              </div>
            </div>

            <button
              onClick={() => handlePurchase(tier.id)}
              disabled={loadingTier !== null}
              className={`
                w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all
                ${tier.popular
                  ? 'bg-gradient-to-r from-neon-blue to-neon-purple text-white hover:opacity-90 shadow-lg'
                  : 'bg-white/5 text-white border border-white/10 hover:bg-white/10'}
                ${loadingTier === tier.id ? 'opacity-70 cursor-wait' : ''}
              `}
            >
              {loadingTier === tier.id ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />
                  Purchase Now
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      <ActionableErrorToast error={error} onClose={() => setError(null)} />
    </div>
  );
};
