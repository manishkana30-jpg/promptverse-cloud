import React, { useEffect, useState } from 'react';
import { Heart, Share2, Code, MessageCircle } from 'lucide-react';

interface ProjectDetails {
  id: string;
  title: string;
  slug: string;
  views_count: number;
  likes_count: number;
  final_video_url: string;
}

import { useParams } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';
import { useAuthStore } from '../store/useAuthStore';

export const WatchPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLiking, setIsLiking] = useState(false);
  const [liked, setLiked] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);
  const user = useAuthStore(state => state.user);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }

    const fetchProject = async () => {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('slug', slug)
          .single();

        if (error) throw error;
        
        if (data) {
          setProject(data as ProjectDetails);
        }
      } catch (err) {
        console.error('Failed to load project:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [slug]);

  const handleLike = async () => {
    if (!user) return alert("Please log in to like this project.");
    if (liked || !project) return;
    setIsLiking(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/community/${project.id}/like`, { method: 'POST' });
      if (response.ok) {
        setLiked(true);
        setProject({ ...project, likes_count: project.likes_count + 1 });
      } else {
        alert('Failed to like project.');
      }
    } catch (err) {
      console.error('Failed to like project', err);
      alert('Network error occurred.');
    } finally {
      setIsLiking(false);
    }
  };

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  const embedCode = `<iframe width="100%" height="100%" src="${currentUrl}?embed=true" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>`;

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>;
  if (!project) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Project not found</div>;

  return (
    <div className="w-full bg-gray-900 min-h-screen pt-12 pb-24 px-4 text-white">
      <div className="max-w-5xl mx-auto">
        <div className="aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-gray-800 mb-8">
          <video 
            src={project.final_video_url} 
            className="w-full h-full object-contain"
            controls 
            autoPlay 
          />
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">{project.title}</h1>
            <p className="text-gray-400 font-medium">{project.views_count.toLocaleString()} views</p>
          </div>
          
          <div className="flex gap-4">
            <button 
              type="button"
              onClick={handleLike}
              disabled={liked || isLiking}
              className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all disabled:opacity-50 ${
                liked ? 'bg-red-500/20 text-red-500 border border-red-500/50' : 'bg-gray-800 hover:bg-gray-700 text-white'
              }`}
            >
              <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} /> 
              {project.likes_count.toLocaleString()} {liked ? 'Liked' : 'Like'}
            </button>
            <div className="relative group">
              <button type="button" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-full font-bold transition-all">
                <Share2 className="w-5 h-5" /> Share
              </button>
              {/* Dropdown for social sharing */}
              <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 flex flex-col p-2">
                <a href={`https://twitter.com/intent/tweet?url=${currentUrl}&text=Check out this AI movie!`} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 hover:bg-gray-700 rounded-lg text-blue-400">
                  X (Twitter)
                </a>
                <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${currentUrl}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 hover:bg-gray-700 rounded-lg text-blue-600">
                  LinkedIn
                </a>
                <a href={`https://wa.me/?text=${currentUrl}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 hover:bg-gray-700 rounded-lg">
                  <MessageCircle className="w-5 h-5 text-green-500" /> WhatsApp
                </a>
                <button type="button" onClick={() => setShowEmbed(!showEmbed)} className="flex items-center gap-3 p-3 hover:bg-gray-700 rounded-lg text-left w-full">
                  <Code className="w-5 h-5 text-gray-400" /> Embed
                </button>
              </div>
            </div>
          </div>
        </div>

        {showEmbed && (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-8 animate-fadeIn">
            <h3 className="font-bold text-lg mb-4">Embed this video</h3>
            <div className="bg-black p-4 rounded-lg font-mono text-sm text-green-400 break-all select-all">
              {embedCode}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
