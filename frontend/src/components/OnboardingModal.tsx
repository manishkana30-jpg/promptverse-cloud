import React, { useState } from 'react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(1);

  if (!isOpen) return null;

  const nextStep = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-lg w-full p-8 shadow-2xl relative">
        {/* Progress Bar */}
        <div className="flex gap-2 mb-6">
          <div className={`h-1.5 rounded-full flex-1 ${step >= 1 ? 'bg-blue-500' : 'bg-gray-700'}`} />
          <div className={`h-1.5 rounded-full flex-1 ${step >= 2 ? 'bg-blue-500' : 'bg-gray-700'}`} />
          <div className={`h-1.5 rounded-full flex-1 ${step >= 3 ? 'bg-blue-500' : 'bg-gray-700'}`} />
        </div>

        {step === 1 && (
          <div className="animate-fadeIn">
            <h2 className="text-2xl font-bold text-white mb-4">Welcome to PromptVerse 🎬</h2>
            <p className="text-gray-300 mb-6 text-lg leading-relaxed">
              You're about to direct your own AI movies. We automatically break down your script into <span className="font-semibold text-blue-400">30 seamless scenes</span> to ensure perfect pacing and rendering quality.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fadeIn">
            <h2 className="text-2xl font-bold text-white mb-4">The Character Bible 📖</h2>
            <p className="text-gray-300 mb-6 text-lg leading-relaxed">
              Upload an image of your main character. Our Vision LLM extracts their permanent traits (face, hair, outfit) and silently injects this <span className="font-semibold text-blue-400">Character Bible</span> into every scene, locking in perfect visual continuity across the entire film.
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="animate-fadeIn">
            <h2 className="text-2xl font-bold text-white mb-4">Atomic Credits ⚡</h2>
            <p className="text-gray-300 mb-6 text-lg leading-relaxed">
              You get <span className="font-semibold text-blue-400">10 Free Credits every day</span> to experiment with Draft quality scenes. 
              Ready for Hollywood? Upgrade to Production Tier to unlock our premium Replicate video models.
            </p>
          </div>
        )}

        <div className="flex justify-end mt-8">
          <button
            onClick={nextStep}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-lg transition-colors shadow-lg shadow-blue-500/30"
          >
            {step === 3 ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};
