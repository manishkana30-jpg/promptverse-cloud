import React, { useEffect, useState } from 'react';
import { Play, Heart, Eye, TrendingUp, Clock } from 'lucide-react';

interface Project {
  id: string;
  title: string;
  slug: string;
  views_count: number;
  likes_count: number;
  final_video_url: string;
}

export const ExplorePage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [sort, setSort] = useState<'trending' | 'newest'>('trending');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeed = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/community/feed?sort=${sort}&limit=12`);
        const data = await response.json();
        if (data.projects) {
          setProjects(data.projects);
        }
      } catch (error) {
        console.error('Failed to fetch community feed:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchFeed();
  }, [sort]);

  const handleCardClick = async (project: Project) => {
    // Record view in background
    fetch(`${import.meta.env.VITE_API_URL || ""}/api/community/${project.id}/view`, { method: 'POST' }).catch(() => {});
    // Navigate to watch page
    window.location.href = `/watch/${project.slug}`;
  };

  return (
    <div className="w-full bg-transparent min-h-screen p-8 text-white">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-5xl font-extrabold text-gradient mb-3 drop-shadow-md">Community Showcase</h1>
          <p className="text-gray-300 text-lg font-light tracking-wide">Discover AI-generated masterpieces created by the community.</p>
        </div>
        <div className="flex bg-dark-surface backdrop-blur-md p-1.5 rounded-xl border border-white/10 shadow-lg">
          <button
            type="button"
            onClick={() => setSort('trending')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg transition-all duration-300 font-medium ${sort === 'trending' ? 'bg-neon-purple/20 text-white shadow-[0_0_10px_rgba(176,38,255,0.4)] border border-neon-purple/50' : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'}`}
          >
            <TrendingUp className={`w-4 h-4 ${sort === 'trending' ? 'text-neon-pink' : ''}`} /> Trending
          </button>
          <button
            type="button"
            onClick={() => setSort('newest')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg transition-all duration-300 font-medium ${sort === 'newest' ? 'bg-neon-blue/20 text-white shadow-[0_0_10px_rgba(0,243,255,0.4)] border border-neon-blue/50' : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'}`}
          >
            <Clock className={`w-4 h-4 ${sort === 'newest' ? 'text-neon-blue' : ''}`} /> Newest
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-32">
          <div className="animate-spin rounded-full h-14 w-14 border-t-2 border-b-2 border-neon-blue shadow-[0_0_15px_rgba(0,243,255,0.5)]"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {projects.map((project) => (
            <div 
              key={project.id} 
              onClick={() => handleCardClick(project)}
              className="glass-panel glass-panel-hover rounded-2xl overflow-hidden cursor-pointer group transform hover:-translate-y-2 relative"
            >
              <div className="relative aspect-video bg-black">
                {/* Hover-to-preview video */}
                <video 
                  src={project.final_video_url} 
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                  muted 
                  loop
                  onMouseOver={(e) => e.currentTarget.play()}
                  onMouseOut={(e) => {
                    e.currentTarget.pause();
                    e.currentTarget.currentTime = 0;
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                  <Play className="w-12 h-12 text-white drop-shadow-lg" fill="currentColor" />
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-xl text-gray-100 mb-3 truncate group-hover:text-neon-blue transition-colors duration-300">{project.title || 'Untitled Masterpiece'}</h3>
                <div className="flex items-center gap-5 text-gray-400 text-sm font-medium">
                  <span className="flex items-center gap-1.5"><Eye className="w-4 h-4 text-neon-purple" /> {project.views_count.toLocaleString()}</span>
                  <span className="flex items-center gap-1.5"><Heart className="w-4 h-4 text-neon-pink drop-shadow-[0_0_5px_rgba(255,0,234,0.5)]" /> {project.likes_count.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
