import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { Loader2 } from 'lucide-react';

export const AdminRoute: React.FC = () => {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-neon-blue animate-spin" />
      </div>
    );
  }

  if (!user || (user.user_metadata?.is_admin !== true && (user as any).role !== 'admin')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <h2 className="text-2xl font-bold text-red-500 mb-2">Access Denied</h2>
        <p className="text-gray-400 mb-4">You need Administrator privileges to view this dashboard.</p>
        <a href="/" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">Return Home</a>
      </div>
    );
  }

  return <Outlet />;
};
