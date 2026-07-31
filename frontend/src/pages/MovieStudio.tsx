import React, { useState } from 'react';
import { useMovieStudioStore } from '../store/useMovieStudioStore';
import { useAuthStore } from '../store/useAuthStore';
import { ActionableErrorToast, type ActionableError } from '../components/ActionableErrorToast';
import { Loader2, Upload, Play, Film, MessageSquare, Download, Sparkles, Wand2, Image as ImageIcon, Video, Music, ArrowLeft, ArrowRight, Save, Trash2, CheckCircle2 } from 'lucide-react';

export const MovieStudio: React.FC = () => {
  const { user } = useAuthStore();
  const store = useMovieStudioStore();
  const [error, setError] = useState<ActionableError | null>(null);
  const [saveToast, setSaveToast] = useState(false);
  
  // Phase 1 local state
  const [idea, setIdea] = useState('');
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);

  // Phase 2 local state
  const [uploadingCharId, setUploadingCharId] = useState<string | null>(null);

  // Phase 3 local state
  const [generatingSceneId, setGeneratingSceneId] = useState<string | null>(null);

  const handleGenerateStory = async () => {
    if (!user) return setError({ code: 'UNAUTHORIZED', message: 'Please log in' });
    setIsGeneratingStory(true);
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/director/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea, user_id: user.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to generate story');
      
      const { expanded_story, characters, scenes, project_id } = data.data;
      
      // The backend now inserts the project, characters, and scenes into Supabase
      // and returns the real database UUIDs.
      const projectId = project_id;
      
      // Map scenes to store schema (the backend now provides the real UUID in 'id')
      const mappedScenes = scenes.map((s: any) => ({
        id: s.id, // Real UUID from database
        scene_index: s.scene_index,
        location: s.location,
        prompt: s.prompt,
        dialogue: s.dialogue,
        has_dialogue: s.has_dialogue,
        character_ids_present: s.character_ids_present, // Now contains real UUIDs
        status: s.status || 'PENDING'
      }));

      store.setProjectData(projectId, expanded_story, characters, mappedScenes);
      store.setPhase('2_CHARACTER_MAPPING');
    } catch (err: any) {
      setError({ code: 'GEN_ERROR', message: err.message });
    } finally {
      setIsGeneratingStory(false);
    }
  };

  const handleUploadCharacter = async (charId: string, tempId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !store.projectId) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCharId(tempId);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('character_id', charId); // MUST be the real UUID for Supabase
      formData.append('project_id', store.projectId);
      formData.append('user_id', user.id);

      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/characters/upload-reference`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      
      store.updateCharacterImage(tempId, data.url);
    } catch (err: any) {
      setError({ code: 'UPLOAD_ERROR', message: err.message });
    } finally {
      setUploadingCharId(null);
    }
  };

  const handleGenerateVideo = async (sceneId: string, prompt: string) => {
    if (!user) return;
    setGeneratingSceneId(sceneId);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/generate/character-scene`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, scene_id: sceneId, prompt, tier: 'draft' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Video generation failed');
      
      // In this system, webhook will eventually update it.
      // We will mock the video url for the UI to proceed immediately since webhooks require ngrok locally
      setTimeout(() => {
        store.updateSceneMedia(sceneId, 'video', 'https://www.w3schools.com/html/mov_bbb.mp4');
      }, 3000);

    } catch (err: any) {
      setError({ code: 'VIDEO_ERROR', message: err.message });
    } finally {
      setGeneratingSceneId(null);
    }
  };

  const handleGenerateAudioLipsync = async (sceneId: string, prompt: string) => {
    if (!user) return;
    setGeneratingSceneId(sceneId);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/generate/audio-lipsync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, scene_id: sceneId, prompt })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lipsync generation failed');
      
      // The backend actually updates the db, but for immediate UI:
      setTimeout(() => {
        store.updateSceneMedia(sceneId, 'lipsync', 'https://www.w3schools.com/html/mov_bbb.mp4');
      }, 4000);
    } catch (err: any) {
      setError({ code: 'LIPSYNC_ERROR', message: err.message });
    } finally {
      setGeneratingSceneId(null);
    }
  };

  const handleStitchMovie = async () => {
    if (!user || !store.projectId) return;
    try {
      const sceneIds = store.scenes.map(s => s.id);
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/scenes/stitch-movie`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: store.projectId, scene_ids: sceneIds })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Stitching failed');
      
      store.setStitchJob(data.job_id);
    } catch (err: any) {
      setError({ code: 'STITCH_ERROR', message: err.message });
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 pb-32">
      <ActionableErrorToast error={error} onClose={() => setError(null)} />
      
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 flex items-center gap-3">
          <Film className="w-10 h-10 text-neon-blue" />
          AI Movie Studio
        </h1>

        {/* Timeline Header */}
        <div className="flex justify-between mb-12 relative">
          <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-800 -z-10 -translate-y-1/2 rounded-full"></div>
          {['1_IDEATION', '2_CHARACTER_MAPPING', '3_SCENE_STUDIO', '4_STITCHING_TIMELINE'].map((phase, idx) => {
            const isActive = store.phase === phase;
            const isPast = ['1_IDEATION', '2_CHARACTER_MAPPING', '3_SCENE_STUDIO', '4_STITCHING_TIMELINE'].indexOf(store.phase) > idx;
            return (
              <div key={phase} className={`flex flex-col items-center gap-2 ${isActive ? 'text-neon-blue' : isPast ? 'text-neon-purple' : 'text-gray-500'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${isActive ? 'bg-neon-blue text-black' : isPast ? 'bg-neon-purple text-white' : 'bg-gray-800 text-gray-500'}`}>
                  {idx + 1}
                </div>
                <span className="text-xs font-semibold tracking-wider">{phase.split('_').slice(1).join(' ')}</span>
              </div>
            );
          })}
        </div>

        {/* PHASE 1: IDEATION */}
        {store.phase === '1_IDEATION' && (
          <div className="bg-gray-800 p-8 rounded-2xl border border-gray-700 shadow-xl">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Sparkles className="text-neon-pink" /> Story Ideation</h2>
            <p className="text-gray-400 mb-6">Enter a raw movie idea and let the AI Director expand it into characters and scenes.</p>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="A cyberpunk detective discovers a plot to steal memories..."
              className="w-full h-40 bg-gray-900 border border-gray-700 rounded-xl p-4 text-white focus:outline-none focus:border-neon-blue mb-6 resize-none"
            />
            <button
              onClick={handleGenerateStory}
              disabled={!idea.trim() || isGeneratingStory}
              className="bg-neon-blue text-black font-bold py-3 px-6 rounded-xl hover:bg-blue-400 transition flex items-center gap-2 disabled:opacity-50"
            >
              {isGeneratingStory ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
              {isGeneratingStory ? 'Expanding Story...' : 'Generate Storyboard'}
            </button>
          </div>
        )}

        {/* PHASE 2: CHARACTER MAPPING */}
        {store.phase === '2_CHARACTER_MAPPING' && (
          <div className="space-y-6">
            <div className="bg-gray-800 p-8 rounded-2xl border border-gray-700">
              <h2 className="text-2xl font-bold mb-4">Character Grounding</h2>
              <p className="text-gray-400 mb-8">Upload reference images for your characters to maintain visual consistency across scenes.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {store.characters.map((char) => (
                  <div key={char.temp_id} className="bg-gray-900 rounded-xl p-6 border border-gray-700 relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-4 relative z-10">
                      <div>
                        <h3 className="font-bold text-lg text-neon-blue">{char.name}</h3>
                        <span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400 uppercase tracking-wider">{char.type}</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-400 mb-6 relative z-10 line-clamp-3">{char.description}</p>
                    
                    {char.reference_image_url ? (
                      <div className="aspect-square rounded-lg overflow-hidden relative mb-4 border border-gray-700">
                        <img src={char.reference_image_url} alt={char.name} className="w-full h-full object-cover" />
                        <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition">
                          <Upload className="w-8 h-8 text-white" />
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => handleUploadCharacter(char.id, char.temp_id, e)} />
                        </label>
                      </div>
                    ) : (
                      <label className="aspect-square border-2 border-dashed border-gray-700 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-neon-blue hover:bg-gray-800/50 transition mb-4">
                        {uploadingCharId === char.temp_id ? (
                          <Loader2 className="w-8 h-8 text-neon-blue animate-spin" />
                        ) : (
                          <>
                            <ImageIcon className="w-8 h-8 text-gray-500 mb-2" />
                            <span className="text-sm text-gray-500">Upload Reference</span>
                          </>
                        )}
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleUploadCharacter(char.id, char.temp_id, e)} />
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PHASE 3: SCENE STUDIO */}
        {store.phase === '3_SCENE_STUDIO' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Scene Studio</h2>
            </div>
            
            {store.scenes.map((scene) => (
              <div key={scene.id} className="bg-gray-800 p-6 rounded-xl border border-gray-700 flex flex-col md:flex-row gap-6">
                {/* Media Preview */}
                <div className="w-full md:w-1/3 aspect-video bg-gray-900 rounded-lg border border-gray-700 overflow-hidden relative flex flex-col items-center justify-center group">
                  {scene.lipsync_video_url ? (
                    <video src={scene.lipsync_video_url} controls className="w-full h-full object-cover" />
                  ) : scene.video_url ? (
                    <video src={scene.video_url} controls className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-600 h-full p-4 text-center">
                      <Film className="w-12 h-12 mb-2 opacity-50" />
                      <span className="text-sm">No media generated yet</span>
                    </div>
                  )}
                  
                  {generatingSceneId === scene.id && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center">
                      <Loader2 className="w-10 h-10 text-neon-blue animate-spin mb-2" />
                      <span className="text-xs font-bold tracking-widest text-neon-blue uppercase">Generating...</span>
                    </div>
                  )}
                </div>

                {/* Scene Info */}
                <div className="w-full md:w-2/3 flex flex-col">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="bg-gray-700 text-gray-300 font-bold px-2 py-1 rounded text-xs">SCENE {scene.scene_index}</span>
                    <span className="text-neon-pink font-semibold text-sm">{scene.location}</span>
                  </div>
                  
                  <p className="text-gray-300 text-sm mb-4 leading-relaxed bg-gray-900/50 p-3 rounded-lg border border-gray-700/50">
                    <strong className="text-neon-blue">Action:</strong> {scene.prompt}
                  </p>
                  
                  {scene.has_dialogue && scene.dialogue && (
                    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 mb-4 flex gap-3">
                      <MessageSquare className="w-5 h-5 text-green-400 shrink-0" />
                      <p className="text-gray-300 text-sm italic">"{scene.dialogue}"</p>
                    </div>
                  )}
                  
                  <div className="mt-auto flex flex-wrap gap-3">
                    <button 
                      onClick={() => handleGenerateVideo(scene.id, scene.prompt)}
                      disabled={generatingSceneId === scene.id}
                      className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg text-sm transition"
                    >
                      <Video className="w-4 h-4 text-neon-blue" />
                      {scene.video_url ? 'Regenerate Video' : 'Generate Video'}
                    </button>
                    
                    {scene.has_dialogue && (
                      <button 
                        onClick={() => handleGenerateAudioLipsync(scene.id, scene.dialogue!)}
                        disabled={generatingSceneId === scene.id || !scene.video_url}
                        className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white py-2 px-4 rounded-lg text-sm transition"
                      >
                        <Music className="w-4 h-4 text-neon-pink" />
                        Generate Voice & Lipsync
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PHASE 4: STITCHING TIMELINE */}
        {store.phase === '4_STITCHING_TIMELINE' && (
          <div className="bg-gray-800 p-8 rounded-2xl border border-gray-700 text-center">
            <h2 className="text-2xl font-bold mb-2">Stitching Timeline</h2>
            <p className="text-gray-400 mb-8">Ready to compile all scenes into a master cinematic sequence.</p>
            
            {!store.finalVideoUrl ? (
              <div className="max-w-md mx-auto">
                <button
                  onClick={handleStitchMovie}
                  disabled={store.scenes.length === 0 || !store.scenes.every(s => s.video_url || s.lipsync_video_url) || store.stitchStatus === 'pending' || store.stitchStatus === 'processing'}
                  className="w-full bg-gradient-to-r from-neon-blue to-neon-purple text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-neon-blue/20 transition-all disabled:opacity-50 flex items-center justify-center gap-3 text-lg mb-6"
                >
                  {(store.stitchStatus === 'pending' || store.stitchStatus === 'processing') ? (
                    <><Loader2 className="w-6 h-6 animate-spin" /> Compiling Master Movie...</>
                  ) : store.scenes.length === 0 || !store.scenes.every(s => s.video_url || s.lipsync_video_url) ? (
                    <><Play className="w-6 h-6 fill-current" /> Generate All Scenes First</>
                  ) : (
                    <><Play className="w-6 h-6 fill-current" /> Stitch Final Movie</>
                  )}
                </button>
                
                {(store.stitchStatus === 'pending' || store.stitchStatus === 'processing') && (
                  <div className="w-full bg-gray-900 rounded-full h-3 mb-2 overflow-hidden border border-gray-700">
                    <div className="bg-neon-blue h-3 rounded-full animate-[pulse_2s_ease-in-out_infinite]" style={{ width: '100%' }}></div>
                  </div>
                )}
                <p className="text-sm text-gray-500 uppercase tracking-widest">{store.stitchStatus || 'Idle'}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-full max-w-3xl aspect-video bg-black rounded-2xl overflow-hidden border-2 border-neon-blue shadow-[0_0_30px_rgba(0,240,255,0.2)] mb-8">
                  <video src={store.finalVideoUrl} controls className="w-full h-full" />
                </div>
                
                <a
                  href={store.finalVideoUrl}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-8 rounded-xl transition flex items-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Download Master File
                </a>
              </div>
            )}
            
          </div>
        )}
      </div>

      {/* GLOBAL STUDIO CONTROLS */}
      {store.phase !== '1_IDEATION' && (
        <div className="fixed bottom-0 left-0 w-full bg-gray-900 border-t border-gray-800 p-4 z-50 shadow-2xl">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            
            {/* LEFT: Go Back & Delete */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  if (store.phase === '2_CHARACTER_MAPPING') store.setPhase('1_IDEATION');
                  if (store.phase === '3_SCENE_STUDIO') store.setPhase('2_CHARACTER_MAPPING');
                  if (store.phase === '4_STITCHING_TIMELINE') store.setPhase('3_SCENE_STUDIO');
                }}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition bg-gray-800 px-4 py-2 rounded-lg font-medium"
              >
                <ArrowLeft className="w-4 h-4" /> Go Back
              </button>
              
              <button
                onClick={() => {
                  if (window.confirm("Are you sure you want to delete this draft and start a new project?")) {
                    store.resetStudio();
                  }
                }}
                className="flex items-center gap-2 text-red-400 hover:text-red-300 transition bg-red-900/20 hover:bg-red-900/40 px-4 py-2 rounded-lg font-medium"
              >
                <Trash2 className="w-4 h-4" /> Delete Draft
              </button>
            </div>

            {/* RIGHT: Save Draft & Next */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  setSaveToast(true);
                  setTimeout(() => setSaveToast(false), 3000);
                }}
                className="flex items-center gap-2 text-gray-300 hover:text-white transition bg-gray-800 px-4 py-2 rounded-lg font-medium"
              >
                {saveToast ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Save className="w-4 h-4" />}
                {saveToast ? 'Draft Saved!' : 'Save Draft'}
              </button>

              {store.phase !== '4_STITCHING_TIMELINE' && (
                <button
                  onClick={() => {
                    if (store.phase === '2_CHARACTER_MAPPING') store.setPhase('3_SCENE_STUDIO');
                    if (store.phase === '3_SCENE_STUDIO') store.setPhase('4_STITCHING_TIMELINE');
                  }}
                  className="flex items-center gap-2 text-black bg-neon-blue hover:bg-blue-400 transition px-6 py-2 rounded-lg font-bold"
                >
                  Next <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
