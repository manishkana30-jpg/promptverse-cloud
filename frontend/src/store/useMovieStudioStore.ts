import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../utils/supabaseClient';

export type StudioPhase = '1_IDEATION' | '2_CHARACTER_MAPPING' | '3_SCENE_STUDIO' | '4_STITCHING_TIMELINE';

export interface Character {
  id: string;
  temp_id: string;
  name: string;
  type: 'human' | 'animal' | 'object';
  description: string;
  reference_image_url?: string;
}

export interface Scene {
  id: string;
  scene_index: number;
  location: string;
  prompt: string;
  dialogue?: string;
  has_dialogue: boolean;
  character_ids_present: string[];
  video_url?: string;
  audio_url?: string;
  lipsync_video_url?: string;
  status: string;
}

interface MovieStudioState {
  phase: StudioPhase;
  projectId: string | null;
  expandedStory: string;
  characters: Character[];
  scenes: Scene[];
  stitchJobId: string | null;
  stitchStatus: string | null;
  finalVideoUrl: string | null;
  
  setPhase: (phase: StudioPhase) => void;
  setProjectData: (projectId: string, story: string, characters: Character[], scenes: Scene[]) => void;
  updateCharacterImage: (tempId: string, url: string) => void;
  updateSceneMedia: (sceneId: string, mediaType: 'video' | 'audio' | 'lipsync', url: string) => void;
  setStitchJob: (jobId: string) => void;
  pollStitchJob: () => void;
  resetStudio: () => void;
}

export const useMovieStudioStore = create<MovieStudioState>()(
  persist(
    (set, get) => ({
      phase: '1_IDEATION',
      projectId: null,
      expandedStory: '',
      characters: [],
      scenes: [],
      stitchJobId: null,
      stitchStatus: null,
      finalVideoUrl: null,

      setPhase: (phase) => set({ phase }),

      setProjectData: (projectId, story, characters, scenes) => 
        set({ projectId, expandedStory: story, characters, scenes }),

      updateCharacterImage: (tempId, url) =>
        set((state) => ({
          characters: state.characters.map((c) =>
            c.temp_id === tempId ? { ...c, reference_image_url: url } : c
          ),
        })),

      updateSceneMedia: (sceneId, mediaType, url) =>
        set((state) => ({
          scenes: state.scenes.map((s) => {
            if (s.id !== sceneId) return s;
            if (mediaType === 'video') return { ...s, video_url: url, status: 'COMPLETED' };
            if (mediaType === 'audio') return { ...s, audio_url: url };
            if (mediaType === 'lipsync') return { ...s, lipsync_video_url: url };
            return s;
          }),
        })),

      setStitchJob: (jobId) => {
        set({ stitchJobId: jobId, stitchStatus: 'pending' });
        get().pollStitchJob();
      },

      pollStitchJob: () => {
        const { stitchJobId } = get();
        if (!stitchJobId) return;

        const interval = setInterval(async () => {
          const { data, error } = await supabase
            .from('stitch_jobs')
            .select('status, final_video_url, error_message')
            .eq('id', stitchJobId)
            .single();

          if (error) {
            console.error('Error polling stitch job:', error);
            clearInterval(interval);
            set({ stitchStatus: 'failed' });
            return;
          }

          set({ stitchStatus: data.status });

          if (data.status === 'completed' || data.status === 'failed') {
            clearInterval(interval);
            if (data.status === 'completed') {
              set({ finalVideoUrl: data.final_video_url });
            } else {
              console.error('Stitch job failed:', data.error_message);
            }
          }
        }, 5000);
      },
      resetStudio: () => set({
        phase: '1_IDEATION',
        projectId: null,
        expandedStory: '',
        characters: [],
        scenes: [],
        stitchJobId: null,
        stitchStatus: null,
        finalVideoUrl: null
      })
    }),
    {
      name: 'movie-studio-storage',
      partialize: (state) => ({ 
        phase: state.phase, 
        projectId: state.projectId, 
        expandedStory: state.expandedStory, 
        characters: state.characters, 
        scenes: state.scenes 
      }) // Persist these fields across reloads
    }
  )
);
