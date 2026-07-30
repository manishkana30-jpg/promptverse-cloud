import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Loader2, TrendingUp } from 'lucide-react';

interface GenerationLog {
  id: string;
  scene_id: string;
  user_id: string;
  prompt: string;
  subject_type: string;
  selected_model: string;
  actual_api_cost: number;
  credits_deducted: number;
  created_at: string;
}

export const AdminAnalytics: React.FC = () => {
  const { user } = useAuthStore();
  const [logs, setLogs] = useState<GenerationLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    fetch(`${import.meta.env.VITE_API_URL || ""}/api/admin/generation-logs`, {
      headers: { 'x-user-id': user.id }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setLogs(data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch logs', err);
        setLoading(false);
      });
  }, [user]);

  // If we wanted strict frontend admin guard, we'd check `user.is_admin`, 
  // but we can assume if the API returns 200, they are admin, or just let ProtectedRoute handle basic auth.
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-neon-blue animate-spin" />
      </div>
    );
  }

  // Aggregate costs by model for chart
  const costByModel = logs.reduce((acc: Record<string, number>, log) => {
    acc[log.selected_model] = (acc[log.selected_model] || 0) + Number(log.actual_api_cost);
    return acc;
  }, {});

  const chartData = Object.keys(costByModel).map(model => ({
    name: model,
    cost: Number(costByModel[model].toFixed(4))
  }));

  const totalSpend = logs.reduce((sum, log) => sum + Number(log.actual_api_cost), 0);

  return (
    <div className="p-8 w-full min-h-screen text-white">
      <div className="flex items-center gap-3 mb-8">
        <TrendingUp className="w-8 h-8 text-neon-pink" />
        <h1 className="text-4xl font-extrabold text-gradient drop-shadow-[0_0_10px_rgba(255,0,234,0.4)]">
          AI Observability & Costs
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="glass-panel p-6 rounded-2xl flex flex-col items-center justify-center text-center col-span-1 lg:col-span-1 border border-neon-blue/20">
          <h3 className="text-gray-400 text-lg font-bold mb-2">Total API Spend</h3>
          <p className="text-5xl font-black text-white">${totalSpend.toFixed(4)}</p>
          <p className="text-sm text-neon-blue mt-2">Across {logs.length} generations</p>
        </div>

        <div className="glass-panel p-6 rounded-2xl col-span-1 lg:col-span-2 border border-white/10 h-80">
          <h3 className="text-gray-400 text-lg font-bold mb-4">Cost by AI Model</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="name" stroke="#888" tick={{ fill: '#ccc' }} />
              <YAxis stroke="#888" tick={{ fill: '#ccc' }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#111', borderColor: '#333' }}
                itemStyle={{ color: '#fff' }}
              />
              <Legend />
              <Bar dataKey="cost" fill="#b026ff" radius={[4, 4, 0, 0]} name="Cost (USD)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-panel p-6 rounded-2xl border border-white/10">
        <h3 className="text-gray-400 text-lg font-bold mb-4">Recent Generation Logs</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-gray-500 text-sm">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Model</th>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4">Prompt</th>
                <th className="py-3 px-4">Cost</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className="border-b border-white/5 hover:bg-white/5 transition-colors text-sm text-gray-300">
                  <td className="py-3 px-4">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="py-3 px-4 font-mono text-neon-blue">{log.selected_model}</td>
                  <td className="py-3 px-4">{log.subject_type}</td>
                  <td className="py-3 px-4 truncate max-w-xs" title={log.prompt}>{log.prompt}</td>
                  <td className="py-3 px-4 text-neon-pink font-bold">${Number(log.actual_api_cost).toFixed(4)}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500 italic">No generation logs found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
