import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../utils/supabaseClient';

interface RateGenerationProps {
  videoId: string;
}

export const RateGeneration: React.FC<RateGenerationProps> = ({ videoId }) => {
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [ratingStats, setRatingStats] = useState<{ total_ratings: number; reward_granted: boolean; ratings_until_next_reward: number } | null>(null);

  const user = useAuthStore(state => state.user);
  const fetchWallet = useAuthStore(state => state.fetchWallet);

  const handleRate = async (selectedRating: number) => {
    if (!user) return;
    if (loading || submitted) return;

    setRating(selectedRating);
    setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/rewards/data-labeling`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: user.id,
          scene_id: videoId,
          rating: selectedRating
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSubmitted(true);
        setRatingStats(data);
        if (data.reward_granted) {
          alert('+5 Credits Earned for completing a rating batch!');
          fetchWallet(user.id);
        }
      } else {
        alert(data.error || 'Failed to submit rating');
        setRating(0); // Reset UI on failure
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred while submitting your rating.');
      setRating(0);
    } finally {
      setLoading(false);
    }
  };

  if (submitted && ratingStats) {
    return (
      <div className="flex flex-col items-center justify-center p-4 bg-gray-800/50 rounded-lg border border-gray-700">
        <p className="text-green-400 font-medium text-sm">Thanks for rating!</p>
        {ratingStats.reward_granted ? (
          <p className="text-yellow-400 font-bold text-xs mt-1">Batch complete! You earned 5 credits.</p>
        ) : (
          <p className="text-gray-400 text-xs mt-1">Rate {ratingStats.ratings_until_next_reward} more scenes to earn 5 credits.</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center p-4 bg-gray-800/30 rounded-lg border border-gray-700">
      <p className="text-gray-300 text-sm font-medium mb-2">
        Rate this generation to earn <span className="text-yellow-400 font-bold">5 Credits</span>
      </p>
      <div className="flex space-x-1" onMouseLeave={() => setHoverRating(0)}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            disabled={loading}
            onMouseEnter={() => setHoverRating(star)}
            onClick={() => handleRate(star)}
            className="focus:outline-none transition-transform hover:scale-110 disabled:opacity-50"
          >
            <Star
              className={`w-6 h-6 ${
                (hoverRating || rating) >= star
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-500 hover:text-gray-400'
              } transition-colors`}
            />
          </button>
        ))}
      </div>
      {loading && <p className="text-xs text-blue-400 mt-2">Submitting...</p>}
    </div>
  );
};
