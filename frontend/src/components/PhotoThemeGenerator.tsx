import React, { useState, useRef } from 'react';
import { useThemeStore } from '../store/useThemeStore';
import { extractColorsFromImage, type ExtractedColors } from '../utils/colorExtractor';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const PhotoThemeGenerator: React.FC<Props> = ({ isOpen, onClose }) => {
  const { applyCustomTheme } = useThemeStore();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedColors, setExtractedColors] = useState<ExtractedColors | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create a local preview URL
    const url = URL.createObjectURL(file);
    setImagePreview(url);
    setIsExtracting(true);
    setExtractedColors(null);

    try {
      const colors = await extractColorsFromImage(url);
      setExtractedColors(colors);
    } catch (error) {
      console.error('Failed to extract colors', error);
      alert('Failed to analyze the image colors. Please try a different photo.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleApplyTheme = () => {
    if (extractedColors) {
      applyCustomTheme(extractedColors);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-dark-surface border border-white/10 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        
        <div className="p-5 border-b border-white/10 flex justify-between items-center bg-black/20">
          <h2 className="text-xl font-bold text-white">Create Custom Photo Theme</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6">
          <p className="text-gray-400 text-sm">
            Upload any image, and we'll analyze the dominant hues to generate a completely custom UI theme for you—for free!
          </p>

          {!imagePreview ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/20 rounded-xl h-48 flex flex-col items-center justify-center cursor-pointer hover:border-neon-blue transition-colors hover:bg-neon-blue/5"
            >
              <Upload className="w-8 h-8 text-gray-400 mb-3" />
              <span className="text-gray-300 font-medium">Click to upload a photo</span>
              <span className="text-gray-500 text-xs mt-1">JPG, PNG, WebP (Max 5MB)</span>
            </div>
          ) : (
            <div className="flex gap-6 items-start">
              <div className="w-32 h-32 rounded-xl overflow-hidden border border-white/20 flex-shrink-0 relative">
                <img src={imagePreview} alt="Uploaded" className="w-full h-full object-cover" />
                {isExtracting && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                )}
              </div>

              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
                  Extracted Palette
                </h3>
                
                {isExtracting ? (
                  <div className="text-neon-blue animate-pulse text-sm">Analyzing pixels...</div>
                ) : extractedColors ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full border border-white/20" style={{ background: extractedColors.primary }} />
                      <span className="text-xs text-gray-400">Primary</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full border border-white/20" style={{ background: extractedColors.secondary }} />
                      <span className="text-xs text-gray-400">Secondary</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full border border-white/20" style={{ background: extractedColors.accent }} />
                      <span className="text-xs text-gray-400">Accent</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full border border-white/20" style={{ background: extractedColors.background }} />
                      <span className="text-xs text-gray-400">Background</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleImageUpload}
          />
        </div>

        <div className="p-5 border-t border-white/10 bg-black/20 flex justify-end gap-3">
          <button 
            onClick={() => {
              setImagePreview(null);
              setExtractedColors(null);
            }}
            className="px-4 py-2 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            Reset
          </button>
          <button 
            onClick={handleApplyTheme}
            disabled={!extractedColors}
            className={`px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-all ${
              extractedColors 
                ? 'bg-neon-blue text-black hover:bg-white shadow-[0_0_15px_rgba(0,243,255,0.4)]' 
                : 'bg-white/10 text-gray-500 cursor-not-allowed'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            Apply Custom Theme
          </button>
        </div>
      </div>
    </div>
  );
};
