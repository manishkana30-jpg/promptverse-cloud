import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../utils/supabaseClient';

export interface Wallet {
  free_credits: number;
  purchased_credits: number;
  last_free_reset_date: string;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  wallet: Wallet | null;
  isLoading: boolean;
  walletError: string | null;
  initializeAuth: () => void;
  signOut: () => Promise<void>;
  fetchWallet: (userId: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  wallet: null,
  isLoading: true,
  walletError: null,

  initializeAuth: () => {
    // Helper function to fetch fresh user data
    const fetchFreshProfile = async (sessionUser: User | null) => {
      if (!sessionUser) return null;
      try {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', sessionUser.id)
          .single();
          
        if (profile) {
          return { ...sessionUser, ...profile, role: profile.is_admin ? 'admin' : 'user' } as any;
        }
      } catch (err) {
        console.error("Failed to fetch fresh user profile", err);
      }
      return sessionUser;
    };

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const freshUser = await fetchFreshProfile(session?.user || null);
      set({ session, user: freshUser, isLoading: false });
      if (freshUser) {
        get().fetchWallet(freshUser.id);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const freshUser = await fetchFreshProfile(session?.user || null);
        set({ session, user: freshUser });
        if (freshUser) {
          get().fetchWallet(freshUser.id);
        } else {
          set({ wallet: null });
        }
      }
    );

    return () => subscription.unsubscribe();
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, wallet: null });
  },

  fetchWallet: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .single();
        
      if (error && error.code !== 'PGRST116') { // PGRST116 is multiple (or no) rows found
        console.error('Error fetching wallet:', error);
        set({ walletError: `Failed to load wallet: ${error.message}` });
      } else if (data) {
        set({ wallet: data as Wallet, walletError: null });
      }
    } catch (err: any) {
      console.error('Failed to fetch wallet:', err);
      set({ walletError: `Failed to fetch wallet: ${err.message || 'Unknown error'}` });
    }
  }
}));
