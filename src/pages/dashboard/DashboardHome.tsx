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
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { 
  TrendingUp, 
  ShoppingBag, 
  AlertCircle, 
  DollarSign, 
  Package,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

const DashboardHome: React.FC = () => {
  const user = useSelector((state: RootState) => state.user.profile);
  const [overview, setOverview] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'7d' | '30d' | 'ytd'>('30d');

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const [overviewData, analyticsData] = await Promise.all([
          brandApi.getDashboardOverview(user.id),
          brandApi.getDashboardAnalytics(user.id, range)
        ]);
        setOverview(overviewData);
        setAnalytics(analyticsData);
      } catch (error) {
        console.error('Failed to fetch dashboard data', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user?.id, range]);

  if (loading && !overview) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black dark:border-white"></div>
      </div>
    );
  }

  const kpis = overview?.kpis || { totalSales: 0, totalOrders: 0, avgOrderValue: 0, pendingOrders: 0 };
  const currency = overview?.currency || 'NGN';
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(val);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Welcome back, {user?.brandFullName || user?.username} 👋
          </p>
        </div>
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-900 p-1 rounded-lg self-start">
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

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard 
          title="Total Sales" 
          value={formatCurrency(kpis.totalSales)} 
          icon={<DollarSign className="w-5 h-5 text-green-600" />}
          trend="+12.5%" 
          trendUp={true}
        />
        <KpiCard 
          title="Total Orders" 
          value={kpis.totalOrders.toString()} 
          icon={<ShoppingBag className="w-5 h-5 text-blue-600" />}
          trend="+5.2%" 
          trendUp={true}
        />
        <KpiCard 
          title="Avg. Order Value" 
          value={formatCurrency(kpis.avgOrderValue)} 
          icon={<TrendingUp className="w-5 h-5 text-purple-600" />}
          trend="-2.1%" 
          trendUp={false}
        />
        <KpiCard 
          title="Pending Orders" 
          value={kpis.pendingOrders.toString()} 
          icon={<Package className="w-5 h-5 text-orange-600" />}
          alert={kpis.pendingOrders > 0}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sales Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900/50 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
          <h3 className="text-lg font-semibold mb-6">Sales Overview</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics?.salesChart || []}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#000000" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#000000" stopOpacity={0}/>
                  </linearGradient>
                </defs>
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
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="#000000" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorSales)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Action Required & Recent Orders */}
        <div className="space-y-6">
          {/* Action Required */}
          {overview?.actionRequired?.length > 0 && (
            <div className="bg-white dark:bg-gray-900/50 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                Action Required
              </h3>
              <div className="space-y-3">
                {overview.actionRequired.map((action: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/10 rounded-xl">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-900 dark:text-red-200">{action.message}</p>
                      <Link to={action.link} className="text-xs text-red-600 dark:text-red-400 hover:underline mt-1 inline-block">
                        View Details &rarr;
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Orders */}
          <div className="bg-white dark:bg-gray-900/50 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Recent Orders</h3>
              <Link to="/dashboard/orders" className="text-sm text-gray-500 hover:text-black dark:hover:text-white">
                View All
              </Link>
            </div>
            <div className="space-y-4">
              {overview?.recentOrders?.map((order: any) => (
                <div key={order.id} className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-xl transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      <Package className="w-5 h-5 text-gray-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{order.customerName}</p>
                      <p className="text-xs text-gray-500">#{order.id.slice(0, 8)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(Number(order.totalAmount))}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      order.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                      order.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
              {(!overview?.recentOrders || overview.recentOrders.length === 0) && (
                <p className="text-sm text-gray-500 text-center py-4">No recent orders</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const KpiCard: React.FC<{ 
  title: string; 
  value: string; 
  icon: React.ReactNode; 
  trend?: string; 
  trendUp?: boolean;
  alert?: boolean;
}> = ({ title, value, icon, trend, trendUp, alert }) => (
  <div className={`bg-white dark:bg-gray-900/50 p-6 rounded-2xl border ${alert ? 'border-red-200 dark:border-red-900/30 ring-2 ring-red-50 dark:ring-red-900/10' : 'border-gray-100 dark:border-gray-800'} shadow-sm transition-all hover:shadow-md`}>
    <div className="flex items-center justify-between mb-4">
      <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">{title}</span>
      <div className={`p-2 rounded-lg ${alert ? 'bg-red-100 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-800'}`}>
        {icon}
      </div>
    </div>
    <div className="flex items-end justify-between">
      <h3 className="text-2xl font-bold tracking-tight">{value}</h3>
      {trend && (
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
          trendUp ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
        }`}>
          {trend}
        </span>
      )}
    </div>
  </div>
);

export default DashboardHome;
