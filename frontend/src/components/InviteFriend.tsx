import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../utils/supabaseClient';
import { Gift, Copy, Check } from 'lucide-react';

export const InviteFriend: React.FC = () => {
  const { user, fetchWallet } = useAuthStore();
  const [referralCode, setReferralCode] = useState<string>('');
  const [applyCode, setApplyCode] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchReferralCode();
    }
  }, [user]);

  const fetchReferralCode = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('referral_codes')
        .select('code')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setReferralCode(data.code);
      } else {
        // Generate one if it doesn't exist
        const newCode = `PV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        await supabase.from('referral_codes').insert({ user_id: user.id, code: newCode });
        setReferralCode(newCode);
      }
    } catch (err) {
      console.error('Error fetching referral code', err);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = async () => {
    if (!user || !applyCode.trim()) return;
    setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/rewards/apply-referral`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: user.id,
          referral_code: applyCode.trim()
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert('+50 Credits Earned for applying a referral code!');
        setApplyCode('');
        fetchWallet(user.id);
      } else {
        alert(data.error || 'Failed to apply referral code');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6 space-y-6">
      <div className="flex items-center space-x-3">
        <div className="bg-purple-500/20 p-2 rounded-lg">
          <Gift className="w-6 h-6 text-purple-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Invite & Earn</h2>
          <p className="text-gray-400 text-sm">Get 50 credits for both you and your friend.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Your Referral Code</label>
          <div className="flex">
            <input
              type="text"
              readOnly
              value={referralCode}
              className="bg-gray-900 border border-gray-700 text-white rounded-l-lg px-4 py-2 w-full focus:outline-none"
            />
            <button
              onClick={handleCopy}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-r-lg flex items-center transition-colors"
            >
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="border-t border-gray-700 pt-4">
          <label className="block text-sm font-medium text-gray-300 mb-1">Have a code?</label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={applyCode}
              onChange={(e) => setApplyCode(e.target.value)}
              placeholder="Enter referral code"
              className="bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2 w-full focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={handleApply}
              disabled={loading || !applyCode.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {loading ? 'Applying...' : 'Apply Code'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
