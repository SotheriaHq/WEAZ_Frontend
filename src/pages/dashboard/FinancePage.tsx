import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { brandApi } from '@/api/BrandApi';
import { 
  DollarSign, 
  CreditCard, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  ArrowUpRight
} from 'lucide-react';
import { toast } from 'sonner';

const FinancePage: React.FC = () => {
  const user = useSelector((state: RootState) => state.user.profile);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [availableBalance, setAvailableBalance] = useState(0); // Mocked for now, should come from API

  useEffect(() => {
    fetchData();
  }, [user?.id]);

  const fetchData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // In a real app, we'd fetch balance separately or as part of overview
      // For now, mocking balance based on "PAID" orders minus "COMPLETED" payouts
      const overview = await brandApi.getDashboardOverview(user.id);
      const payoutsData = await brandApi.getPayouts(user.id);
      
      const totalSales = overview?.kpis?.totalSales || 0;
      const totalPaidOut = payoutsData?.reduce((sum: number, p: any) => 
        p.status === 'COMPLETED' ? sum + Number(p.amount) : sum, 0) || 0;
      
      setAvailableBalance(Math.max(0, totalSales - totalPaidOut));
      setPayouts(payoutsData || []);
    } catch (error) {
      console.error('Failed to fetch finance data', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPayout = async () => {
    if (!user?.id) return;
    if (availableBalance < 5000) {
      toast.error('Minimum payout amount is ₦5,000');
      return;
    }

    setRequesting(true);
    try {
      await brandApi.requestPayout(user.id, availableBalance);
      toast.success('Payout requested successfully');
      fetchData();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to request payout');
    } finally {
      setRequesting(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(val);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Manage your earnings and payouts.</p>
        </div>
      </div>

      {/* Balance Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-black dark:bg-white text-white dark:text-black rounded-2xl p-8 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <DollarSign className="w-32 h-32" />
          </div>
          <div className="relative z-10">
            <p className="text-sm font-medium opacity-80 mb-1">Available Balance</p>
            <h2 className="text-4xl font-bold tracking-tight mb-6">{formatCurrency(availableBalance)}</h2>
            
            <button 
              onClick={handleRequestPayout}
              disabled={requesting || availableBalance < 5000}
              className="bg-white dark:bg-black text-black dark:text-white px-6 py-3 rounded-xl font-semibold text-sm hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
            >
              {requesting ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <ArrowUpRight className="w-4 h-4" />
              )}
              Request Payout
            </button>
            {availableBalance < 5000 && (
              <p className="text-xs mt-3 opacity-70 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Minimum payout: ₦5,000
              </p>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900/50 rounded-2xl p-8 border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col justify-center">
          <h3 className="text-lg font-semibold mb-4">Payout Account</h3>
          <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
            <div className="w-12 h-12 bg-white dark:bg-gray-700 rounded-full flex items-center justify-center shadow-sm">
              <CreditCard className="w-6 h-6 text-gray-600 dark:text-gray-300" />
            </div>
            <div>
              <p className="font-medium">Bank Transfer</p>
              <p className="text-sm text-gray-500">To your registered bank account</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-4 text-center">
            To update your bank details, please contact support.
          </p>
        </div>
      </div>

      {/* Payout History */}
      <div className="bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-lg font-semibold">Payout History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 font-medium">
              <tr>
                <th className="px-6 py-4">Reference</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </td>
                </tr>
              ) : payouts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    No payout history found.
                  </td>
                </tr>
              ) : (
                payouts.map((payout) => (
                  <tr key={payout.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      #{payout.id.slice(0, 8)}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(payout.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {formatCurrency(Number(payout.amount))}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        payout.status === 'COMPLETED' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                        payout.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' :
                        'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                      }`}>
                        {payout.status === 'COMPLETED' ? <CheckCircle className="w-3 h-3" /> :
                         payout.status === 'PENDING' ? <Clock className="w-3 h-3" /> :
                         <XCircle className="w-3 h-3" />}
                        {payout.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FinancePage;
