import React, { useState, useEffect } from 'react';

interface CountdownTimerProps {
  lastResetDate: string | null;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({ lastResetDate }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      // Reset happens at midnight UTC next day based on lastResetDate, or tonight if null
      const resetTime = new Date();
      resetTime.setUTCHours(24, 0, 0, 0); // Next midnight UTC

      const difference = resetTime.getTime() - now.getTime();

      if (difference > 0) {
        const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((difference / 1000 / 60) % 60);
        const seconds = Math.floor((difference / 1000) % 60);
        
        setTimeLeft(
          `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`
        );
      } else {
        setTimeLeft('Credits Resetting...');
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [lastResetDate]);

  return (
    <div className="bg-gray-800 text-gray-200 px-4 py-2 rounded-lg flex items-center shadow-inner border border-gray-700">
      <span className="text-sm font-medium mr-2">Next 10 Free Credits In:</span>
      <span className="text-md font-mono font-bold text-blue-400">{timeLeft}</span>
    </div>
  );
};
