import React, { useEffect, useState, useRef } from 'react';
import { useStoryboardStore } from '../store/useStoryboardStore';
import { Play, Sparkles, Loader2, AlertCircle, Download, Video, Mic, Smile } from 'lucide-react';
import { trackEvent, posthog } from '../utils/analytics';
import { CountdownTimer } from './CountdownTimer';
import { OnboardingModal } from './OnboardingModal';
import { SceneEditDrawer } from './SceneEditDrawer';
import { GenerateMediaModal, type MediaType } from './GenerateMediaModal';
import { useAuthStore } from '../store/useAuthStore';
import { useProjectStore } from '../store/useProjectStore';
import { ActionableErrorToast, type ActionableError } from './ActionableErrorToast';
import { RateGeneration } from './RateGeneration';
import { SocialShareButton } from './SocialShareButton';

export const StoryboardTimeline: React.FC = () => {
  const { user, wallet } = useAuthStore();
  const { activeProject } = useProjectStore();
  const { scenes, setScenes, connectSSE, disconnectSSE, error: storyboardError, clearError: clearStoryboardError } = useStoryboardStore();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [generateMediaType, setGenerateMediaType] = useState<MediaType>('video');
  const [activeSceneId, setActiveSceneId] = useState<string | undefined>();
  const [masterPrompt, setMasterPrompt] = useState('');
  const [isGeneratingMaster, setIsGeneratingMaster] = useState(false);
  const hasTracked = useRef(false);
  const [actionableError, setActionableError] = useState<ActionableError | null>(null);

  const [isUpgrading, setIsUpgrading] = useState(false);

  const handleRegenerateScene = async (sceneId: string, newPrompt: string, imageUrl?: string) => {
    if (!user) return alert("Please log in to perform this action.");
    trackEvent('single_scene_regenerated', { sceneId });
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/generate/character-scene`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user_id: user.id, 
          scene_id: sceneId, 
          prompt: newPrompt, 
          tier: 'draft',
          character_image_url: imageUrl 
        })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        if (errorData && errorData.error) {
          setActionableError(errorData.error);
        } else {
          setActionableError({ code: 'REGEN_FAILED', message: 'Failed to regenerate scene. Please check your credit balance.' });
        }
        const updatedScenes = scenes.map(s => s.id === sceneId ? { ...s, status: 'FAILED' } : s);
        setScenes(updatedScenes as any);
        return;
      }
    } catch (error: any) {
      console.error(error);
      setActionableError({ code: 'NETWORK_ERROR', message: error.message || 'Network error occurred during regeneration.' });
      const updatedScenes = scenes.map(s => s.id === sceneId ? { ...s, status: 'FAILED' } : s);
      setScenes(updatedScenes as any);
    }
  };

  const handleGenerateNewMedia = async (prompt: string, type: MediaType, imageUrl?: string, targetSceneId?: string, withWatermark?: boolean) => {
    if (!user) return alert("Please log in to perform this action.");
    if (!targetSceneId) return alert("Error: Scene ID is missing.");
    trackEvent('new_media_generated', { type });
    
    // Update existing scene to GENERATING state
    useStoryboardStore.getState().updateSceneStatus(targetSceneId, { 
      status: 'GENERATING',
      isGenerating: { 
        ...useStoryboardStore.getState().scenes.find(s => s.id === targetSceneId)?.isGenerating || { video: false, audio: false, lipsync: false },
        [type]: true 
      }
    });

    const endpoint = type === 'video' ? `${import.meta.env.VITE_API_URL || ""}/api/generate/character-scene` : 
                     type === 'audio' ? `${import.meta.env.VITE_API_URL || ""}/api/generate/audio` : 
                     `${import.meta.env.VITE_API_URL || ""}/api/generate/lipsync`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user_id: user.id, 
          scene_id: targetSceneId, 
          prompt, 
          tier: 'draft',
          character_image_url: imageUrl,
          withWatermark
        })
      });
      if (!response.ok) {
        const errorData = await response.json();
        if (errorData && errorData.error) {
          setActionableError(errorData.error);
        } else {
          setActionableError({ code: 'GENERATE_FAILED', message: `Failed to generate ${type}.` });
        }
        
        useStoryboardStore.getState().updateSceneStatus(targetSceneId, { 
          status: 'FAILED',
          isGenerating: { 
            ...useStoryboardStore.getState().scenes.find(s => s.id === targetSceneId)?.isGenerating || { video: false, audio: false, lipsync: false },
            [type]: false 
          }
        });
      }
    } catch (error: any) {
      console.error(error);
      setActionableError({ code: 'NETWORK_ERROR', message: error.message || 'Network error occurred.' });
      useStoryboardStore.getState().updateSceneStatus(targetSceneId, { 
        status: 'FAILED',
        isGenerating: { 
          ...useStoryboardStore.getState().scenes.find(s => s.id === targetSceneId)?.isGenerating || { video: false, audio: false, lipsync: false },
          [type]: false 
        }
      });
    }
  };

  const handleGenerateMaster = async () => {
    console.log("1. Button Clicked! Prompt length:", masterPrompt?.length);
    if (!user) return alert("Please log in to perform this action.");
    if (!masterPrompt.trim()) {
      setActionableError({ code: 'EMPTY_PROMPT', message: 'Please enter a story description before generating.' });
      return;
    }
    
    let targetProject = activeProject;
    if (!targetProject) {
      console.log("activeProject was null, attempting auto-recovery...");
      await useProjectStore.getState().ensureDefaultProject();
      targetProject = useProjectStore.getState().activeProject;
    }

    if (!targetProject) {
      setActionableError({ code: 'NO_PROJECT', message: 'No active project found. Please try refreshing the page.', remedy: 'Refresh your browser or check your internet connection.' });
      return;
    }

    setIsGeneratingMaster(true);
    trackEvent('master_storyboard_requested');

    try {
      console.log("2. Sending request to backend at /api/generate/master-storyboard...");
      const response = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/generate/master-storyboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user_id: user.id, 
          project_id: targetProject.id,
          master_prompt: masterPrompt 
        })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        if (errorData && errorData.error) {
          throw errorData.error; // Throw the structured error object
        }
        throw new Error('Failed to generate master storyboard');
      }

      const result = await response.json();
      if (result.success) {
        console.log("3. Generation Successful!");
        // Append new placeholder scenes to the timeline
        const newScenes = result.scenes.map((s: any) => ({
          ...s,
          audio_url: null,
          lipsync_url: null,
          isGenerating: { video: false, audio: false, lipsync: false }
        }));
        setScenes([...scenes, ...newScenes]);
        setMasterPrompt('');
      } else {
        throw new Error(result.error || 'Failed to generate master storyboard');
      }
    } catch (error: any) {
      console.error("Frontend Generation Error:", error);
      if (error.code) {
        // If it's a structured ActionableError
        setActionableError(error);
      } else {
        setActionableError({
          code: 'GENERATE_ERROR',
          message: error.message || 'An error occurred while communicating with the server.'
        });
      }
    } finally {
      setIsGeneratingMaster(false);
    }
  };

  useEffect(() => {
    // Isolate analytics to prevent excessive triggers, guarded by useRef for Strict Mode
    if (!hasTracked.current && user) {
      posthog.init('phc_mock_key');
      posthog.identify(user.id);
      trackEvent('wallet_connected', { userId: user.id });
      hasTracked.current = true;
    }

    // Check FTUX state
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
      localStorage.setItem('hasSeenOnboarding', 'true');
    }
  }, [user]); // Empty dependency array prevents re-render triggers (Wait, added user to dependency array)

  useEffect(() => {
    // Initialize SSE connection on mount
    if (user) {
      connectSSE(user.id);
    }
    return () => {
      disconnectSSE();
    };
  }, [user, connectSSE, disconnectSSE]);

  // Surface store-level errors as toasts
  useEffect(() => {
    if (storyboardError && !actionableError) {
      setActionableError({ code: 'STORE_ERROR', message: storyboardError });
      clearStoryboardError();
    }
  }, [storyboardError, actionableError, clearStoryboardError]);

  const handleUpgradeTo4K = async () => {
    if (!user) return alert("Please log in to upgrade.");
    setIsUpgrading(true);
    trackEvent('tier_2_upgrade_clicked');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, tier: 'production', creditsAmount: 100 })
      });
      const data = await response.json();
      if (response.ok && data.url) {
        window.location.href = data.url;
      } else {
        alert('Failed to initiate checkout.');
      }
    } catch (error) {
      console.error(error);
      alert('Checkout error. Please try again later.');
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleDownload = (sceneId: string) => {
    trackEvent('video_downloaded', { sceneId });
    alert('Downloading video...');
  };

  return (
    <div className="w-full bg-transparent min-h-screen p-8 text-white relative">
      <OnboardingModal isOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />
      
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-extrabold text-gradient drop-shadow-[0_0_10px_rgba(176,38,255,0.4)]">
          Storyboard Timeline
        </h1>
        <div className="flex items-center gap-4">
          <CountdownTimer lastResetDate={wallet?.last_free_reset_date || new Date().toISOString()} />
          <button 
            type="button"
            onClick={handleUpgradeTo4K}
            disabled={isUpgrading}
            className="flex items-center gap-2 bg-gradient-to-r from-neon-purple to-neon-pink hover:from-neon-pink hover:to-neon-purple disabled:opacity-50 text-white px-7 py-3.5 rounded-xl font-bold shadow-[0_0_20px_rgba(255,0,234,0.4)] transition-all duration-300 transform hover:scale-105 border border-white/20"
          >
            {isUpgrading ? <Loader2 className="w-5 h-5 text-yellow-200 animate-spin" /> : <Sparkles className="w-5 h-5 text-yellow-200" />}
            Upgrade to 4K Production
          </button>
        </div>
      </div>
      
      {/* Director's Master Script Input */}
      <div className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden mb-8">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neon-purple via-neon-pink to-neon-blue"></div>
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-neon-purple" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Director's Master Script</h3>
        </div>
        <textarea
          value={masterPrompt}
          onChange={(e) => setMasterPrompt(e.target.value)}
          placeholder="Describe your entire story here. (e.g., A 3-part commercial. Scene 1: A realistic human introducing the show. Scene 2: A stylized cartoon cat responding.)"
          className="w-full h-24 bg-gray-800 text-sm text-gray-200 p-3 rounded-lg border border-gray-700 focus:outline-none focus:border-neon-purple focus:ring-1 focus:ring-neon-purple resize-none"
        />
        <div className="flex justify-end">
          <button
            onClick={handleGenerateMaster}
            disabled={isGeneratingMaster || !masterPrompt.trim()}
            className="flex items-center gap-2 bg-gradient-to-r from-neon-purple to-neon-pink hover:from-purple-500 hover:to-pink-500 text-white px-5 py-2 rounded-lg font-bold text-sm transition-all shadow-[0_0_15px_rgba(176,38,255,0.4)] disabled:opacity-50"
          >
            {isGeneratingMaster ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {isGeneratingMaster ? 'Orchestrating...' : 'Generate Full Storyboard'}
          </button>
        </div>
      </div>

      <div className="flex overflow-x-auto pb-12 gap-8 snap-x hide-scrollbar px-2">
        {scenes.length === 0 ? (
          <div className="text-gray-500 italic">No scenes generated yet.</div>
        ) : (
          scenes.map((scene, index) => (
            <div 
              key={scene.id} 
              className={`flex-none w-[340px] glass-panel glass-panel-hover rounded-2xl overflow-hidden snap-center flex flex-col group ${
                scene.status === 'GENERATING' ? 'neon-border' : 
                scene.status === 'COMPLETED' ? 'neon-border-purple' : 'border-white/10'
              }`}
            >
              <div className="p-4 bg-black/40 border-b border-white/10 flex justify-between items-center backdrop-blur-sm">
                <h3 className="font-bold text-gray-200 tracking-wide">Scene {index + 1}</h3>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  scene.status === 'COMPLETED' ? 'bg-neon-purple/20 text-neon-pink shadow-[0_0_10px_rgba(255,0,234,0.3)]' :
                  scene.status === 'GENERATING' ? 'bg-neon-blue/20 text-neon-blue animate-pulse shadow-[0_0_10px_rgba(0,243,255,0.3)]' :
                  scene.status === 'FAILED' ? 'bg-red-500/20 text-red-400' :
                  'bg-white/5 text-gray-400 border border-white/10'
                }`}>
                  {scene.status}
                </span>
              </div>
              
              <div className="relative w-full aspect-video bg-black flex items-center justify-center">
                {scene.status === 'COMPLETED' && scene.video_url ? (
                  <>
                    <video 
                      src={scene.video_url} 
                      className="w-full h-full object-cover"
                      controls 
                      autoPlay={false}
                      loop 
                      muted
                    />
                    <button 
                      onClick={() => handleDownload(scene.id)}
                      className="absolute top-2 right-2 bg-black/60 hover:bg-blue-600 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Download Scene"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2">
                      <RateGeneration videoId={scene.id} />
                      <SocialShareButton videoId={scene.id} />
                    </div>
                  </>
                ) : scene.status === 'GENERATING' ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-12 h-12 text-neon-blue animate-spin drop-shadow-[0_0_8px_rgba(0,243,255,0.8)]" />
                    <span className="text-neon-blue text-sm font-bold tracking-widest uppercase animate-pulse">Rendering Video...</span>
                  </div>
                ) : scene.status === 'FAILED' ? (
                  <div className="flex flex-col items-center gap-2 text-red-400">
                    <AlertCircle className="w-8 h-8" />
                    <span className="text-sm">Generation Failed</span>
                  </div>
                ) : (
                  <div className="text-gray-600 flex flex-col items-center gap-2">
                    <Play className="w-8 h-8 opacity-50" />
                    <span className="text-sm">Awaiting Generation</span>
                  </div>
                )}
              </div>

              <div className="p-4 flex-grow flex flex-col">
                <p className="text-sm text-gray-400 line-clamp-4 leading-relaxed">
                  {scene.prompt}
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <SceneEditDrawer 
                    sceneId={scene.id} 
                    initialPrompt={scene.prompt} 
                    currentVersion={1}
                    onRegenerate={handleRegenerateScene}
                  />
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-800">
                    <button 
                      type="button"
                      onClick={() => { setActiveSceneId(scene.id); setGenerateMediaType('video'); setIsGenerateModalOpen(true); }}
                      disabled={scene.isGenerating?.video}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-gray-800 hover:bg-neon-blue/20 border border-gray-700 hover:border-neon-blue/50 text-white text-xs py-1.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {scene.isGenerating?.video ? <Loader2 className="w-3.5 h-3.5 animate-spin text-neon-blue" /> : <Video className="w-3.5 h-3.5 text-neon-blue" />}
                      Video
                    </button>
                    
                    <button 
                      type="button"
                      onClick={() => { setActiveSceneId(scene.id); setGenerateMediaType('audio'); setIsGenerateModalOpen(true); }}
                      disabled={scene.isGenerating?.audio}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-gray-800 hover:bg-neon-pink/20 border border-gray-700 hover:border-neon-pink/50 text-white text-xs py-1.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {scene.isGenerating?.audio ? <Loader2 className="w-3.5 h-3.5 animate-spin text-neon-pink" /> : <Mic className="w-3.5 h-3.5 text-neon-pink" />}
                      Audio
                    </button>
                    
                    <button 
                      type="button"
                      onClick={() => { setActiveSceneId(scene.id); setGenerateMediaType('lipsync'); setIsGenerateModalOpen(true); }}
                      disabled={!scene.video_url || !scene.audio_url || scene.isGenerating?.lipsync}
                      title={(!scene.video_url || !scene.audio_url) ? "Requires both Video and Audio to be generated first" : ""}
                      className="flex-[2] flex items-center justify-center gap-1.5 bg-gray-800 hover:bg-neon-purple/20 border border-gray-700 hover:border-neon-purple/50 text-white text-xs py-1.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {scene.isGenerating?.lipsync ? <Loader2 className="w-3.5 h-3.5 animate-spin text-neon-purple" /> : <Smile className="w-3.5 h-3.5 text-neon-purple" />}
                      Lip Sync
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <GenerateMediaModal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        mediaType={generateMediaType}
        sceneId={activeSceneId}
        onGenerate={handleGenerateNewMedia}
      />

      <ActionableErrorToast 
        error={actionableError} 
        onClose={() => setActionableError(null)} 
      />
    </div>
  );
};
