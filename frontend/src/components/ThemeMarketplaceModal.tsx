import React from 'react';
import { useThemeStore, defaultThemes } from '../store/useThemeStore';
import { X, Lock, CheckCircle, Sparkles } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ThemeMarketplaceModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { activeTheme, unlockedThemes, setTheme, unlockTheme } = useThemeStore();

  if (!isOpen) return null;

  const handlePurchase = (themeId: string) => {
    unlockTheme(themeId);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-dark-surface border border-white/10 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/20">
          <div>
            <h2 className="text-2xl font-extrabold text-gradient">Aesthetic Themes</h2>
            <p className="text-gray-400 text-sm mt-1">Unlock premium visual styles</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          {defaultThemes.map(theme => {
            const isUnlocked = !theme.isPremium || unlockedThemes.includes(theme.id);
            const isActive = activeTheme?.id === theme.id;

            return (
              <div 
                key={theme.id} 
                className={`rounded-xl border p-5 flex flex-col transition-all duration-300 ${
                  isActive ? 'border-neon-blue shadow-[0_0_15px_rgba(0,243,255,0.2)] bg-neon-blue/5' : 
                  isUnlocked ? 'border-white/20 hover:border-white/40 bg-white/5' : 
                  'border-white/5 bg-black/40 grayscale-[0.5] opacity-80'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-lg text-white flex items-center gap-2">
                    {theme.name}
                    {!isUnlocked && <Lock className="w-4 h-4 text-gray-500" />}
                  </h3>
                  {isActive && <CheckCircle className="w-5 h-5 text-neon-blue" />}
                </div>

                <div className="flex gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full shadow-md" style={{ background: theme.colors.primary }} />
                  <div className="w-8 h-8 rounded-full shadow-md" style={{ background: theme.colors.secondary }} />
                  <div className="w-8 h-8 rounded-full shadow-md" style={{ background: theme.colors.accent }} />
                  <div className="w-8 h-8 rounded-full shadow-md border border-white/20" style={{ background: theme.colors.background }} />
                </div>

                <div className="mt-auto">
                  {isUnlocked ? (
                    <button 
                      onClick={() => setTheme(theme)}
                      disabled={isActive}
                      className={`w-full py-2.5 rounded-lg font-bold transition-all ${
                        isActive 
                          ? 'bg-neon-blue/20 text-neon-blue cursor-not-allowed' 
                          : 'bg-white/10 hover:bg-white/20 text-white'
                      }`}
                    >
                      {isActive ? 'Active Theme' : 'Apply Theme'}
                    </button>
                  ) : (
                    <button 
                      onClick={() => handlePurchase(theme.id)}
                      className="w-full py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-neon-purple to-neon-pink text-white hover:scale-[1.02] transition-transform shadow-lg"
                    >
                      <Sparkles className="w-4 h-4 text-yellow-200" />
                      Unlock for 50 Credits
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
