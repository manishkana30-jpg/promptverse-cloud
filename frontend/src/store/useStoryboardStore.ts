import { create } from 'zustand';

export interface Scene {
  id: string;
  prompt: string;
  video_url: string | null;
  audio_url: string | null;
  lipsync_url: string | null;
  status: 'PLANNING' | 'GENERATING' | 'COMPLETED' | 'FAILED';
  isGenerating: {
    video: boolean;
    audio: boolean;
    lipsync: boolean;
  };
}

interface StoryboardState {
  scenes: Scene[];
  error: string | null;
  setScenes: (scenes: Scene[]) => void;
  addScene: (scene: Scene) => void;
  updateSceneStatus: (sceneId: string, updates: Partial<Scene>) => void;
  connectSSE: (userId: string) => void;
  disconnectSSE: () => void;
  fetchScenes: (projectId: string) => Promise<void>;
  clearError: () => void;
  eventSource: EventSource | null;
  sseRetryCount: number;
}

export const useStoryboardStore = create<StoryboardState>((set, get) => ({
  scenes: [],
  eventSource: null,
  error: null,
  sseRetryCount: 0,

  clearError: () => set({ error: null }),

  setScenes: (scenes) => set({ scenes }),
  
  addScene: (scene) => set((state) => ({
    scenes: [...state.scenes, scene]
  })),

  updateSceneStatus: (sceneId, updates) => set((state) => ({
    scenes: state.scenes.map(scene => 
      scene.id === sceneId 
        ? { ...scene, ...updates }
        : scene
    )
  })),

  connectSSE: (userId) => {
    const current = get().eventSource;
    const url = `${import.meta.env.VITE_API_URL || ""}/api/stream?user_id=${userId}`;

    // CRITICAL FIX: Prevent unnecessary reconnects if already connected
    if (current && current.url === url && current.readyState !== EventSource.CLOSED) {
      return;
    }

    // CRITICAL FIX: Explicitly nullify listeners before closing to prevent memory leaks
    if (current) {
      current.onmessage = null;
      current.onerror = null;
      current.close();
    }

    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        const { type, data } = parsed;
        
        const { updateSceneStatus } = get();

        switch (type) {
          case 'VIDEO_READY':
            updateSceneStatus(data.scene_id, { status: 'COMPLETED', video_url: data.video_url, isGenerating: { ...get().scenes.find(s => s.id === data.scene_id)?.isGenerating || { video: false, audio: false, lipsync: false }, video: false } });
            break;
          case 'VIDEO_FAILED':
            updateSceneStatus(data.scene_id, { status: 'FAILED', isGenerating: { ...get().scenes.find(s => s.id === data.scene_id)?.isGenerating || { video: false, audio: false, lipsync: false }, video: false } });
            break;
          case 'SCENE_STATUS_UPDATE':
            updateSceneStatus(data.scene_id, { status: data.status });
            break;
          case 'connected':
            console.log('SSE Connected:', data.message);
            break;
        }
      } catch (err) {
        console.warn('Failed to parse SSE message:', err);
      }
    };

    eventSource.onopen = () => {
      // Reset retry count on successful connection
      set({ sseRetryCount: 0 });
    };

    eventSource.onerror = () => {
      const retryCount = get().sseRetryCount + 1;
      const MAX_SSE_RETRIES = 5;

      if (retryCount >= MAX_SSE_RETRIES) {
        console.warn(`SSE: Max retries (${MAX_SSE_RETRIES}) reached. Disconnecting.`);
        get().disconnectSSE();
        set({ error: 'Live connection lost. Refresh the page to reconnect.', sseRetryCount: retryCount });
      } else {
        set({ sseRetryCount: retryCount });
      }
    };

    set({ eventSource });
  },

  disconnectSSE: () => {
    const { eventSource } = get();
    if (eventSource) {
      eventSource.onmessage = null;
      eventSource.onerror = null;
      eventSource.close();
      set({ eventSource: null });
    }
  },

  fetchScenes: async (projectId: string) => {
    try {
      const { supabase } = await import('../utils/supabaseClient');
      const { data, error } = await supabase
        .from('scenes')
        .select('*')
        .eq('project_id', projectId)
        .order('id', { ascending: true });
        
      if (error) {
        console.error('Error fetching scenes:', error);
        set({ error: `Failed to load scenes: ${error.message}` });
      } else if (data) {
        set({ scenes: data as Scene[], error: null });
      }
    } catch (err: any) {
      console.error('Failed to fetch scenes:', err);
      set({ error: `Failed to fetch scenes: ${err.message || 'Unknown error'}` });
    }
  }
}));
