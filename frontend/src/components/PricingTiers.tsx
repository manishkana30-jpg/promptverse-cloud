import React, { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { Check, Zap } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { InviteFriend } from './InviteFriend';

declare global {
  interface Window {
    Razorpay: any;
  }
}

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const tiers = [
  { id: 'starter', name: 'Starter', price: 10, credits: 100, popular: false, features: ['100 Generation Credits', 'Standard Processing', 'Basic Support'] },
  { id: 'creator', name: 'Creator', price: 40, credits: 500, popular: true, features: ['500 Generation Credits', 'Priority Processing', 'Email Support'] },
  { id: 'studio', name: 'Studio', price: 100, credits: 1500, popular: false, features: ['1500 Generation Credits', 'Highest Priority', 'Dedicated Support', 'API Access'] }
];

export const PricingTiers: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const fetchWallet = useAuthStore(state => state.fetchWallet);
  const [loading, setLoading] = useState<string | null>(null);

  const handlePayment = async (tierId: string) => {
    if (!user) return alert('Please sign in first');
    setLoading(tierId);

    const res = await loadRazorpayScript();
    if (!res) {
      alert('Razorpay SDK failed to load. Are you online?');
      setLoading(null);
      return;
    }

    try {
      // 1. Create Order
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const orderResponse = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/pay/razorpay/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ user_id: user.id, tier: tierId })
      });

      const orderData = await orderResponse.json();
      if (!orderData.success) throw new Error(orderData.error);

      // 2. Open Razorpay Checkout Modal
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || '', // Needs to be in .env
        amount: orderData.amount,
        currency: orderData.currency,
        name: "PromptVerse AI Studio",
        description: `${tiers.find(t => t.id === tierId)?.name} Tier`,
        order_id: orderData.order_id,
        handler: async function (response: any) {
          try {
            // 3. Verify Signature
            const verifyResponse = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/pay/razorpay/verify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                user_id: user.id,
                credits: orderData.credits
              })
            });

            const verifyData = await verifyResponse.json();
            if (verifyData.success) {
              alert('Payment successful! Credits added.');
              fetchWallet(user.id);
            } else {
              alert('Verification failed: ' + verifyData.error);
            }
          } catch (err) {
            console.error(err);
            alert('Something went wrong during verification.');
          }
        },
        prefill: {
          email: user.email
        },
        theme: {
          color: "#3B82F6"
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        alert(`Payment Failed: ${response.error.description}`);
      });
      rzp.open();

    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Payment initiation failed');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="py-12 bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            Power up your AI Generation
          </h2>
          <p className="mt-4 text-xl text-gray-400">
            Choose the right credit pack for your creative needs.
          </p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-3 lg:gap-x-8">
          {tiers.map((tier) => (
            <div key={tier.id} className={`relative p-8 bg-gray-800 border ${tier.popular ? 'border-blue-500' : 'border-gray-700'} rounded-2xl shadow-sm flex flex-col`}>
              {tier.popular && (
                <div className="absolute top-0 -translate-y-1/2 left-1/2 -translate-x-1/2">
                  <span className="inline-flex rounded-full bg-blue-500 px-4 py-1 text-sm font-semibold tracking-wider text-white uppercase">
                    Most Popular
                  </span>
                </div>
              )}
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-white">{tier.name}</h3>
                <p className="mt-4 flex items-baseline text-white">
                  <span className="text-5xl font-extrabold tracking-tight">${tier.price}</span>
                </p>
                <p className="mt-2 text-blue-400 flex items-center">
                  <Zap className="w-5 h-5 mr-1" />
                  {tier.credits} Credits
                </p>
                <ul role="list" className="mt-6 space-y-4">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex">
                      <Check className="flex-shrink-0 w-5 h-5 text-green-500" />
                      <span className="ml-3 text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => handlePayment(tier.id)}
                disabled={loading === tier.id}
                className={`mt-8 block w-full py-3 px-6 border border-transparent rounded-md text-center font-medium ${
                  tier.popular 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-gray-700 hover:bg-gray-600 text-white'
                } transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
              >
                {loading === tier.id ? 'Processing...' : 'Pay with UPI / Card'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-xl mx-auto mt-12">
        <InviteFriend />
      </div>
    </div>
  );
};
