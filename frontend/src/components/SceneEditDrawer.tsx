import React, { useState, useRef } from 'react';
import { History, RefreshCw, Edit3, X, ImagePlus, Loader2 } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { useAuthStore } from '../store/useAuthStore';

interface SceneEditDrawerProps {
  sceneId: string;
  initialPrompt: string;
  currentVersion: number;
  onRegenerate: (sceneId: string, newPrompt: string, imageUrl?: string) => void;
}

export const SceneEditDrawer: React.FC<SceneEditDrawerProps> = ({ sceneId, initialPrompt, currentVersion, onRegenerate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [selectedVersion, setSelectedVersion] = useState(currentVersion);
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();

  const handleRegenerate = () => {
    onRegenerate(sceneId, prompt, imageUrl);
    setIsOpen(false);
  };

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
      alert(err.message || 'Upload failed. Please ensure the storage bucket exists and RLS policies are configured.');
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) {
    return (
      <button 
        type="button"
        onClick={() => setIsOpen(true)}
        className="mt-4 flex items-center justify-center gap-2 w-full bg-gray-700 hover:bg-gray-600 text-sm font-medium text-white py-2 rounded-lg transition-colors"
      >
        <Edit3 className="w-4 h-4" /> Edit & Regenerate
      </button>
    );
  }

  return (
    <div className="mt-4 bg-gray-900 border border-gray-700 rounded-lg p-4 animate-fadeIn flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-bold text-gray-300 flex items-center gap-2">
          <Edit3 className="w-4 h-4" /> Edit Prompt
        </h4>
        <button type="button" onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
      
      <textarea 
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="w-full h-24 bg-gray-800 text-sm text-gray-300 p-3 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none scrollbar-thin scrollbar-thumb-gray-600"
      />
      
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold text-gray-400">Subject Image (Optional)</label>
        {imageUrl ? (
          <div className="relative w-full h-24 rounded-lg overflow-hidden border border-gray-700">
            <img src={imageUrl} alt="Subject" className="w-full h-full object-cover" />
            <button 
              type="button"
              onClick={() => setImageUrl(undefined)}
              className="absolute top-1 right-1 bg-black/50 p-1 rounded-full text-white hover:bg-red-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full h-12 border border-dashed border-gray-600 rounded-lg flex items-center justify-center gap-2 text-sm text-gray-400 hover:bg-gray-800 transition-colors"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
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
      
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <History className="w-4 h-4" />
          <select 
            value={selectedVersion} 
            onChange={(e) => setSelectedVersion(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded p-1 outline-none"
          >
            {[...Array(currentVersion)].map((_, i) => (
              <option key={i + 1} value={i + 1}>v{i + 1} {i + 1 === currentVersion ? '(Current)' : ''}</option>
            ))}
          </select>
        </div>
        
        <button 
          type="button"
          onClick={handleRegenerate}
          disabled={isUploading}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold py-2 px-4 rounded-lg transition-colors shadow-lg shadow-blue-500/20"
        >
          <RefreshCw className="w-3 h-3" /> Re-render Clip (5 Credits)
        </button>
      </div>
    </div>
  );
};
