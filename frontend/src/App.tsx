import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { StoryboardTimeline } from './components/StoryboardTimeline';
import { ExplorePage } from './pages/ExplorePage';
import { WatchPage } from './pages/WatchPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminAnalytics } from './pages/AdminAnalytics';
import { AuthPage } from './pages/AuthPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminRoute } from './components/AdminRoute';
import { MovieStudio } from './pages/MovieStudio';
import { useStoryboardStore } from './store/useStoryboardStore';
import { useThemeStore } from './store/useThemeStore';
import { useAuthStore } from './store/useAuthStore';
import { useProjectStore } from './store/useProjectStore';
import { StarTrailCanvas } from './components/StarTrailCanvas';
import { ThemeMarketplaceModal } from './components/ThemeMarketplaceModal';
import { PhotoThemeGenerator } from './components/PhotoThemeGenerator';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Sidebar } from './components/Sidebar';
import { Loader2 } from 'lucide-react';

const ThemeEngine: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const activeTheme = useThemeStore(state => state.activeTheme);
  
  useEffect(() => {
    document.documentElement.className = ''; // Reset
    if (activeTheme) {
      document.documentElement.classList.add(activeTheme.id);
      
      const root = document.documentElement;
      root.style.setProperty('--color-neon-blue', activeTheme.colors.primary);
      root.style.setProperty('--color-neon-purple', activeTheme.colors.secondary);
      root.style.setProperty('--color-neon-pink', activeTheme.colors.accent);
      root.style.setProperty('--color-dark-bg', activeTheme.colors.background);
      root.style.setProperty('--color-dark-surface', activeTheme.colors.surface);
    }
  }, [activeTheme]);

  return <>{children}</>;
};

function App() {
  const [showMarketplace, setShowMarketplace] = React.useState(false);
  const [showPhotoGen, setShowPhotoGen] = React.useState(false);
  
  const { initializeAuth, user, isLoading } = useAuthStore();
  const { ensureDefaultProject, activeProject } = useProjectStore();
  const fetchScenes = useStoryboardStore(state => state.fetchScenes);
  const setScenes = useStoryboardStore(state => state.setScenes);

  useEffect(() => {
    const cleanup = initializeAuth();
    return cleanup;
  }, [initializeAuth]);

  useEffect(() => {
    if (user) {
      ensureDefaultProject();
    } else {
      setScenes([]);
    }
  }, [user, ensureDefaultProject, setScenes]);

  useEffect(() => {
    if (activeProject) {
      fetchScenes(activeProject.id);
    }
  }, [activeProject, fetchScenes]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-neon-blue animate-spin" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeEngine>
        <Router>
          <StarTrailCanvas />
          <ThemeMarketplaceModal isOpen={showMarketplace} onClose={() => setShowMarketplace(false)} />
          <PhotoThemeGenerator isOpen={showPhotoGen} onClose={() => setShowPhotoGen(false)} />

          <div className="min-h-screen w-full relative z-10 flex">
            <ErrorBoundary>
              <Sidebar 
                onOpenMarketplace={() => setShowMarketplace(true)} 
                onOpenPhotoTheme={() => setShowPhotoGen(true)} 
              />
            </ErrorBoundary>
            
            <div className="flex-1 ml-64 relative">
              <ErrorBoundary>
                <Routes>
                  <Route path="/" element={<Navigate to="/explore" replace />} />
                  <Route path="/explore" element={<ExplorePage />} />
                  <Route path="/watch/:slug" element={<WatchPage />} />
                  <Route path="/auth" element={<AuthPage />} />
                  
                    <Route element={<ProtectedRoute />}>
                    <Route path="/studio" element={<StoryboardTimeline />} />
                    <Route path="/movie-studio" element={<MovieStudio />} />
                    
                    {/* Admin Routes wrapped in AdminRoute */}
                    <Route element={<AdminRoute />}>
                      <Route path="/admin" element={<AdminDashboard />} />
                      <Route path="/admin/analytics" element={<AdminAnalytics />} />
                    </Route>
                  </Route>
                </Routes>
              </ErrorBoundary>
            </div>
          </div>
        </Router>
      </ThemeEngine>
    </ErrorBoundary>
  );
}

export default App;
