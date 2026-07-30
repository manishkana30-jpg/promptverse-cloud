import React, { useState, useRef, useEffect } from 'react';
import { X, ImagePlus, Loader2, Video, Mic, Smile, Sparkles } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { useAuthStore } from '../store/useAuthStore';
import { ActionableErrorToast, type ActionableError } from './ActionableErrorToast';

export type MediaType = 'video' | 'audio' | 'lipsync';

interface GenerateMediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaType: MediaType;
  sceneId?: string;
  onGenerate: (prompt: string, type: MediaType, imageUrl?: string, sceneId?: string, withWatermark?: boolean) => Promise<void> | void;
}

export const GenerateMediaModal: React.FC<GenerateMediaModalProps> = ({ 
  isOpen, 
  onClose, 
  mediaType,
  sceneId,
  onGenerate 
}) => {
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [withWatermark, setWithWatermark] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();
  const [actionableError, setActionableError] = useState<ActionableError | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPrompt('');
      setImageUrl(undefined);
      setIsUploading(false);
      setWithWatermark(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      const { data } = supabase.storage.from('media').getPublicUrl(fileName);
      setImageUrl(data.publicUrl);
    } catch (err: any) {
      console.error("Upload failed:", err);
      setActionableError({ 
        code: 'UPLOAD_FAILED', 
        message: err.message || 'Upload failed. Please ensure the storage bucket exists and RLS policies are configured.' 
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onGenerate(prompt, mediaType, imageUrl, sceneId, withWatermark);
      onClose();
    } catch (err: any) {
      console.error('Generation submission error:', err);
      setActionableError({ code: 'SUBMIT_ERROR', message: err.message || 'Failed to submit generation request.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const configs = {
    video: { title: 'Generate Scene', subtitle: 'Create a video from your text prompt', icon: <Video className="w-5 h-5 text-neon-blue" />, placeholder: 'Describe your scene in detail...', color: 'bg-neon-blue' },
    audio: { title: 'Add Voiceover', subtitle: 'Generate audio from your script', icon: <Mic className="w-5 h-5 text-neon-pink" />, placeholder: 'Enter the script for the voiceover...', color: 'bg-neon-pink' },
    lipsync: { title: 'Lip-Sync Character', subtitle: 'Sync dialogue to your image', icon: <Smile className="w-5 h-5 text-neon-purple" />, placeholder: 'Enter the dialogue script...', color: 'bg-neon-purple' },
  };

  const config = configs[mediaType];
  const requiresImage = mediaType === 'video' || mediaType === 'lipsync';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fadeIn">
        <div className="flex items-center justify-between p-5 border-b border-gray-800 bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-neon-blue/20 to-neon-purple/20 rounded-lg">
              {config.icon}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{config.title}</h2>
              <p className="text-sm text-gray-400">{config.subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-gray-300">Prompt / Script</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={config.placeholder}
                className="w-full h-32 bg-gray-800 text-sm text-gray-200 p-4 rounded-xl border border-gray-700 focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue resize-none"
                required
              />
            </div>

            {requiresImage && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-gray-300">
                  Subject Image
                </label>
                {imageUrl ? (
                  <div className="relative w-full h-32 rounded-xl overflow-hidden border border-gray-700">
                    <img src={imageUrl} alt="Subject" className="w-full h-full object-cover" />
                    <button 
                      type="button"
                      onClick={() => setImageUrl(undefined)}
                      className="absolute top-2 right-2 bg-black/60 p-1.5 rounded-full text-white hover:bg-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full h-20 border-2 border-dashed border-gray-600 rounded-xl flex items-center justify-center gap-2 text-sm text-gray-400 hover:bg-gray-800 hover:border-gray-500 transition-all"
                  >
                    {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
                    {isUploading ? 'Uploading...' : 'Upload Subject Image'}
                  </button>
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
              </div>
            )}

            {mediaType === 'video' && (
              <div className="flex items-center gap-2 mt-2">
                <input 
                  type="checkbox" 
                  id="watermark" 
                  checked={withWatermark}
                  onChange={(e) => setWithWatermark(e.target.checked)}
                  className="w-4 h-4 text-neon-blue bg-gray-800 border-gray-700 rounded focus:ring-neon-blue focus:ring-2"
                />
                <label htmlFor="watermark" className="text-sm text-gray-300">
                  Share with Watermark to earn 20 credits (Skip deduction)
                </label>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!prompt.trim() || isSubmitting}
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all shadow-[0_0_15px_rgba(0,0,0,0.2)] flex items-center gap-2 ${config.color} ${
                  (!prompt.trim() || isSubmitting) ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
                }`}
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isSubmitting ? 'Generating...' : `Generate ${mediaType === 'video' ? 'Video' : mediaType === 'audio' ? 'Audio' : 'Lip-Sync'}`}
              </button>
            </div>
          </form>
        </div>
      </div>
      <ActionableErrorToast 
        error={actionableError} 
        onClose={() => setActionableError(null)} 
      />
    </div>
  );
};
