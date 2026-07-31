import React from 'react';
import { NavLink } from 'react-router-dom';
import { Compass, Film, Settings, Palette, Camera, Sparkles, LogOut, LogIn, Wallet } from 'lucide-react';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';

interface Props {
  onOpenMarketplace: () => void;
  onOpenPhotoTheme: () => void;
}

export const Sidebar: React.FC<Props> = ({ onOpenMarketplace, onOpenPhotoTheme }) => {
  const { isStarTrailEnabled, toggleStarTrail } = useThemeStore();
  const { user, wallet, signOut } = useAuthStore();

  return (
    <div className="fixed inset-y-0 left-0 w-64 bg-dark-surface border-r border-white/10 z-40 flex flex-col pt-8 pb-6 px-4 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-2 mb-10">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center shadow-[0_0_15px_rgba(0,243,255,0.4)]">
          <Film className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-xl font-extrabold text-white tracking-tight">PromptVerse</h1>
      </div>

      <nav className="flex-1 flex flex-col gap-2">
        <NavLink 
          to="/explore" 
          className={({ isActive }) => 
            `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
              isActive 
                ? 'bg-neon-blue/10 text-neon-blue shadow-[inset_4px_0_0_rgba(0,243,255,1)]' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`
          }
        >
          <Compass className="w-5 h-5" />
          Community Explore
        </NavLink>
        
        <NavLink 
          to="/movie-studio" 
          className={({ isActive }) => 
            `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
              isActive 
                ? 'bg-neon-blue/10 text-neon-blue shadow-[inset_4px_0_0_rgba(0,243,255,1)]' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`
          }
        >
          <Sparkles className="w-5 h-5" />
          Movie Studio Engine
        </NavLink>
        
        <NavLink 
          to="/admin" 
          className={({ isActive }) => 
            `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
              isActive 
                ? 'bg-white/10 text-white shadow-[inset_4px_0_0_rgba(255,255,255,1)]' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`
          }
        >
          <Settings className="w-5 h-5" />
          Admin Dashboard
        </NavLink>

        <NavLink 
          to="/billing" 
          className={({ isActive }) => 
            `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
              isActive 
                ? 'bg-neon-pink/10 text-neon-pink shadow-[inset_4px_0_0_rgba(255,0,255,1)]' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`
          }
        >
          <Wallet className="w-5 h-5" />
          Buy Credits
        </NavLink>
      </nav>

      <div className="pt-6 border-t border-white/10 flex flex-col gap-3">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-2 mb-2">Visuals</h3>
        
        <button 
          onClick={onOpenMarketplace}
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-sm transition-all text-white bg-gradient-to-r from-neon-purple/50 to-neon-blue/50 hover:from-neon-purple hover:to-neon-blue border border-white/10 shadow-lg"
        >
          <Palette className="w-4 h-4" />
          Theme Marketplace
        </button>
        
        <button 
          onClick={onOpenPhotoTheme}
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-sm transition-all text-gray-300 bg-white/5 hover:bg-white/10 border border-white/10"
        >
          <Camera className="w-4 h-4 text-gray-400" />
          Photo Generator
        </button>

        <button 
          onClick={toggleStarTrail}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-sm transition-all border mt-2 ${
            isStarTrailEnabled 
              ? 'bg-neon-blue/20 text-neon-blue border-neon-blue/30 shadow-[0_0_10px_rgba(0,243,255,0.2)]' 
              : 'bg-white/5 text-gray-500 border-white/10'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Star Trail: {isStarTrailEnabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {user ? (
        <div className="mt-6 pt-6 border-t border-white/10 flex flex-col gap-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <Wallet className="w-4 h-4 text-neon-pink" />
              <span>{wallet?.free_credits ?? 0} Free</span>
            </div>
          </div>
          <button 
            onClick={() => signOut()}
            className="flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      ) : (
        <div className="mt-6 pt-6 border-t border-white/10">
          <NavLink 
            to="/auth"
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition-all text-white bg-gradient-to-r from-neon-blue to-neon-purple hover:shadow-[0_0_15px_rgba(0,243,255,0.4)]"
          >
            <LogIn className="w-5 h-5" />
            Sign In
          </NavLink>
        </div>
      )}
    </div>
  );
};
