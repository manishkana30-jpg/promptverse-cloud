import React, { useEffect, useState } from 'react';
import { ShieldAlert, Users, TrendingUp, AlertTriangle, UserX, UserCheck, EyeOff } from 'lucide-react';

interface Metrics {
  activeUsers: number;
  creditsConsumed: number;
  totalRevenue: number;
  failureRate: string;
}

import { useAuthStore } from '../store/useAuthStore';

export const AdminDashboard: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [targetUser, setTargetUser] = useState('');
  const [creditAdjustment, setCreditAdjustment] = useState('');
  const [targetProject, setTargetProject] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    
    const fetchMetrics = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/admin/metrics`, {
          headers: { 'x-user-id': user.id }
        });
        
        if (!res.ok) {
          throw new Error(`Failed to fetch metrics: ${res.status} ${res.statusText}`);
        }
        
        const data = await res.json();
        setMetrics(data);
        setError(null);
      } catch (err: any) {
        console.error("Admin dashboard fetch error:", err);
        setError(err.message || 'An error occurred while loading the dashboard.');
      }
    };
    
    fetchMetrics();
  }, [user]);

  const handleAdjustCredits = async () => {
    if (!user) return alert("Please log in as an admin to perform this action.");
    if (!targetUser || !creditAdjustment) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/admin/user/${targetUser}/credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
        body: JSON.stringify({ amount: parseInt(creditAdjustment, 10) })
      });
      if (res.ok) {
        alert('Credits adjusted successfully!');
        setCreditAdjustment('');
      } else {
        alert('Failed to adjust credits.');
      }
    } catch (e) {
      console.error(e);
      alert('Network error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleBan = async (isBanned: boolean) => {
    if (!user) return alert("Please log in as an admin to perform this action.");
    if (!targetUser) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/admin/user/${targetUser}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
        body: JSON.stringify({ is_banned: isBanned })
      });
      if (res.ok) {
        alert(`User ${isBanned ? 'banned' : 'unbanned'} successfully!`);
      } else {
        alert('Failed to update ban status.');
      }
    } catch (e) {
      console.error(e);
      alert('Network error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnpublishProject = async () => {
    if (!user) return alert("Please log in as an admin to perform this action.");
    if (!targetProject) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/admin/community/${targetProject}/moderate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
        body: JSON.stringify({ is_public: false })
      });
      if (res.ok) {
        alert('Project unpublished successfully!');
        setTargetProject('');
      } else {
        alert('Failed to unpublish project.');
      }
    } catch (e) {
      console.error(e);
      alert('Network error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-6 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <header className="flex items-center gap-3 mb-10">
          <ShieldAlert className="w-8 h-8 text-red-500" />
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-orange-500">
            Admin Command Center
          </h1>
        </header>

        {/* METRICS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-400 font-semibold">Active Users</h3>
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-3xl font-bold">{metrics?.activeUsers || 0}</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-400 font-semibold">Credits Burned</h3>
              <TrendingUp className="w-5 h-5 text-orange-400" />
            </div>
            <p className="text-3xl font-bold">{metrics?.creditsConsumed || 0}</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-400 font-semibold">Total Revenue</h3>
              <span className="text-green-400 font-bold">$</span>
            </div>
            <p className="text-3xl font-bold text-green-400">${(metrics?.totalRevenue || 0).toFixed(2)}</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-400 font-semibold">GPU Fail Rate</h3>
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <p className="text-3xl font-bold text-red-400">{metrics?.failureRate || '0%'}</p>
          </div>
        </div>

        {/* MANAGEMENT */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl shadow-lg">
            <h2 className="text-xl font-bold mb-6 text-gray-200">User Moderation</h2>
            <div className="space-y-4">
              <input 
                type="text" 
                placeholder="Target User UUID" 
                value={targetUser}
                onChange={(e) => setTargetUser(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded p-3 text-white focus:outline-none focus:border-red-500"
              />
              
              <div className="flex gap-4">
                <input 
                  type="number" 
                  placeholder="Credits (+/-)" 
                  value={creditAdjustment}
                  onChange={(e) => setCreditAdjustment(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded p-3 text-white focus:outline-none"
                />
                <button 
                  type="button"
                  onClick={handleAdjustCredits}
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-2 px-6 rounded transition-colors whitespace-nowrap"
                >
                  Adjust
                </button>
              </div>

              <div className="flex gap-4 pt-4 border-t border-gray-800">
                <button 
                  type="button"
                  onClick={() => handleToggleBan(true)}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-900/50 hover:bg-red-900 text-red-400 border border-red-800 disabled:opacity-50 font-bold py-2 px-4 rounded transition-colors"
                >
                  <UserX className="w-4 h-4" /> Ban User
                </button>
                <button 
                  type="button"
                  onClick={() => handleToggleBan(false)}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 disabled:opacity-50 font-bold py-2 px-4 rounded transition-colors"
                >
                  <UserCheck className="w-4 h-4" /> Unban
                </button>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl shadow-lg">
            <h2 className="text-xl font-bold mb-6 text-gray-200">Community Safety</h2>
            <div className="space-y-4">
              <input 
                type="text" 
                placeholder="Target Project UUID (Flagged)" 
                value={targetProject}
                onChange={(e) => setTargetProject(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded p-3 text-white focus:outline-none focus:border-red-500"
              />
              
              <button 
                type="button"
                onClick={handleUnpublishProject}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold py-3 px-6 rounded transition-colors"
              >
                <EyeOff className="w-5 h-5" /> Unpublish Content
              </button>
              
              <p className="text-sm text-gray-500 mt-4 text-center">
                This will immediately remove the project from the /explore feed.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
