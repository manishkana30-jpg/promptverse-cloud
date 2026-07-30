import React, { useState } from 'react';
import { Share2, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

interface SocialShareButtonProps {
  videoId: string;
}

export const SocialShareButton: React.FC<SocialShareButtonProps> = ({ videoId }) => {
  const { user, fetchWallet } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [shared, setShared] = useState(false);

  const handleShare = async (platform: 'twitter' | 'tiktok') => {
    if (!user) return;
    setLoading(true);

    try {
      // 1. Simulate opening share dialog
      const shareUrl = platform === 'twitter' 
        ? `https://twitter.com/intent/tweet?text=Check out my AI video generated with %23OurApp!&url=https://ourapp.com/video/${videoId}`
        : `https://www.tiktok.com/`; // TikTok doesn't have a direct URL share intent in the same way
      
      window.open(shareUrl, '_blank');

      // 2. Call backend to claim reward
      const { supabase } = await import('../utils/supabaseClient');
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/rewards/social-share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: user.id,
          video_id: videoId,
          platform
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setShared(true);
        alert('+20 Credits Earned for sharing!');
        fetchWallet(user.id);
      } else {
        // Silent fail or alert if not duplicate
        if (!data.error?.includes('already claimed')) {
          console.error(data.error);
        } else {
          setShared(true); // Already shared
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (shared) {
    return (
      <div className="flex items-center justify-center gap-1.5 bg-green-500/20 text-green-400 text-xs py-1.5 rounded-lg w-full mt-2">
        <Share2 className="w-3.5 h-3.5" />
        Shared (+20 Credits)
      </div>
    );
  }

  return (
    <div className="flex gap-2 w-full mt-2">
      <button
        onClick={() => handleShare('twitter')}
        disabled={loading}
        className="flex-1 flex items-center justify-center gap-1.5 bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 text-xs py-1.5 rounded-lg transition-all disabled:opacity-50"
        title="Share this video on X (Twitter) with #OurApp to earn 20 free credits"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
        X (Twitter)
      </button>
      <button
        onClick={() => handleShare('tiktok')}
        disabled={loading}
        className="flex-1 flex items-center justify-center gap-1.5 bg-pink-500/20 hover:bg-pink-500/40 text-pink-400 text-xs py-1.5 rounded-lg transition-all disabled:opacity-50"
        title="Share this video on TikTok with #OurApp to earn 20 free credits"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
        TikTok
      </button>
    </div>
  );
};
