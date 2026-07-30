import { create } from 'zustand';

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
}

export interface Theme {
  id: string;
  name: string;
  isPremium: boolean;
  colors: ThemeColors;
}

interface ThemeState {
  activeTheme: Theme | null;
  unlockedThemes: string[];
  isStarTrailEnabled: boolean;
  
  setTheme: (theme: Theme) => void;
  unlockTheme: (themeId: string) => void;
  toggleStarTrail: () => void;
  applyCustomTheme: (colors: ThemeColors) => void;
}

export const defaultThemes: Theme[] = [
  {
    id: 'cyberpunk-neon',
    name: 'Cyberpunk Neon',
    isPremium: false,
    colors: {
      primary: '#00f3ff', // neon-blue
      secondary: '#b026ff', // neon-purple
      accent: '#ff00ea', // neon-pink
      background: '#050505',
      surface: 'rgba(20, 20, 25, 0.7)'
    }
  },
  {
    id: 'ethereal-obsidian',
    name: 'Ethereal Obsidian',
    isPremium: true,
    colors: {
      primary: '#d4af37', // gold
      secondary: '#c0c0c0', // silver
      accent: '#ffffff',
      background: '#0a0a0c',
      surface: 'rgba(15, 15, 20, 0.8)'
    }
  },
  {
    id: 'retro-synthwave',
    name: 'Retro Synthwave',
    isPremium: true,
    colors: {
      primary: '#f3e600', // yellow
      secondary: '#ff0055', // pink-red
      accent: '#00f0ff', // cyan
      background: '#2b0f4c', // deep purple
      surface: 'rgba(50, 20, 80, 0.7)'
    }
  }
];

export const useThemeStore = create<ThemeState>((set) => ({
  activeTheme: defaultThemes[0],
  unlockedThemes: ['cyberpunk-neon'],
  isStarTrailEnabled: true,

  setTheme: (theme) => set({ activeTheme: theme }),
  
  unlockTheme: (themeId) => set((state) => ({
    unlockedThemes: state.unlockedThemes.includes(themeId) 
      ? state.unlockedThemes 
      : [...state.unlockedThemes, themeId]
  })),

  toggleStarTrail: () => set((state) => ({ isStarTrailEnabled: !state.isStarTrailEnabled })),

  applyCustomTheme: (colors) => {
    const customTheme: Theme = {
      id: 'custom-photo-theme',
      name: 'Custom Photo Theme',
      isPremium: false,
      colors
    };
    set({ activeTheme: customTheme });
  }
}));
