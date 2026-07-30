import { create } from 'zustand';
import { supabase } from '../utils/supabaseClient';
import { useAuthStore } from './useAuthStore';

export interface Project {
  id: string;
  user_id: string;
  title: string;
  tier: string | null;
  final_video_url: string | null;
}

interface ProjectState {
  projects: Project[];
  activeProject: Project | null;
  isLoading: boolean;
  error: string | null;
  fetchProjects: () => Promise<void>;
  ensureDefaultProject: () => Promise<void>;
  setActiveProject: (project: Project) => void;
  clearError: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProject: null,
  isLoading: false,
  error: null,

  setActiveProject: (project) => set({ activeProject: project }),
  clearError: () => set({ error: null }),

  fetchProjects: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('id', { ascending: true });
        
      if (error) {
        console.error('Error fetching projects:', error);
        set({ error: `Failed to load projects: ${error.message}` });
      } else if (data) {
        set({ projects: data as Project[] });
        if (data.length > 0 && !get().activeProject) {
          set({ activeProject: data[0] as Project });
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch projects:', err);
      set({ error: `Failed to fetch projects: ${err.message || 'Unknown error'}` });
    } finally {
      set({ isLoading: false });
    }
  },

  ensureDefaultProject: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    // Fetch to see if any project exists
    await get().fetchProjects();
    const projects = get().projects;

    if (projects.length === 0) {
      // 1. Ensure user exists in public.users to satisfy foreign key
      await supabase.from('users').upsert({ id: user.id, email: user.email || 'user@promptverse.app' });

      // 2. Create default project
      const { data, error } = await supabase
        .from('projects')
        .insert([{
          user_id: user.id,
          title: 'My First Project',
          tier: 'draft'
        }])
        .select()
        .single();
        
      if (error) {
        console.error('Error creating default project:', error);
        set({ error: `Failed to create project: ${error.message}` });
      } else if (data) {
        set({ projects: [data as Project], activeProject: data as Project, error: null });
      }
    } else if (!get().activeProject) {
      set({ activeProject: projects[0] as Project, error: null });
    }
  }
}));
