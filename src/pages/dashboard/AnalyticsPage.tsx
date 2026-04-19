import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { brandApi } from '@/api/BrandApi';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { Calendar } from 'lucide-react';
import StudioPageSkeleton from '@/components/studio/StudioPageSkeleton';

const AnalyticsPage: React.FC = () => {
  const user = useSelector((state: RootState) => state.user.profile);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'7d' | '30d' | 'ytd'>('30d');

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const analyticsData = await brandApi.getDashboardAnalytics(user.id, range);
        setData(analyticsData);
      } catch (error) {
        console.error('Failed to fetch analytics', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user?.id, range]);

  if (loading && !data) {
    return <StudioPageSkeleton variant="dashboard" />;
  }

  const currency = data?.currency || 'NGN';

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Detailed insights into your store's performance.</p>
        </div>
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-900 p-1 rounded-lg">
          {(['7d', '30d', 'ytd'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                range === r 
                  ? 'bg-white dark:bg-gray-800 shadow-sm text-black dark:text-white' 
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : 'Year'}
            </button>
          ))}
        </div>
      </div>

      {/* Sales Chart */}
      <div className="bg-white dark:bg-gray-900/50 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
        <h3 className="text-lg font-semibold mb-6">Revenue Over Time</h3>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.salesChart || []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: '#6B7280' }}
                tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: '#6B7280' }}
                tickFormatter={(val) => `${val / 1000}k`}
              />
              <Tooltip 
                cursor={{ fill: 'transparent' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value: number) => [new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(value), 'Revenue']}
              />
              <Bar 
                dataKey="amount" 
                fill="#000000" 
                radius={[4, 4, 0, 0]}
                barSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Placeholder for more advanced metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900/50 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center text-center h-64">
          <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
            <Calendar className="w-6 h-6 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium">Traffic Sources</h3>
          <p className="text-sm text-gray-500 mt-1">Coming soon</p>
        </div>
        <div className="bg-white dark:bg-gray-900/50 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center text-center h-64">
          <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
            <Calendar className="w-6 h-6 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium">Customer Demographics</h3>
          <p className="text-sm text-gray-500 mt-1">Coming soon</p>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
