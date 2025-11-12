/**
 * PHASE 5: Category Suggestions Settings Page
 * Admin interface to review and moderate category suggestions
 */
import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { CategorySuggestionsApi } from '@/api/CategorySuggestionsApi';

interface CategorySuggestion {
  id: string;
  name: string;
  proposedBy: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason?: string;
  createdAt: string;
  updatedAt: string;
  proposerId: string;
  proposerUsername?: string;
  decidedBy?: string;
  decidedByUsername?: string;
}

const CategorySuggestionsSettings: React.FC = () => {
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [moderating, setModerating] = useState<string | null>(null);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const data = await CategorySuggestionsApi.getAll();
      setSuggestions(data);
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? 'Failed to load category suggestions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const handleApprove = async (id: string) => {
    setModerating(id);
    try {
      await CategorySuggestionsApi.moderate(id, 'APPROVED');
      toast.success('Category approved! Related draft collections will be published automatically.');
      await fetchSuggestions();
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? 'Failed to approve category');
    } finally {
      setModerating(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Enter rejection reason (optional):');
    setModerating(id);
    try {
      await CategorySuggestionsApi.moderate(id, 'REJECTED', reason || undefined);
      toast.success('Category rejected. Users will be notified.');
      await fetchSuggestions();
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? 'Failed to reject category');
    } finally {
      setModerating(null);
    }
  };

  const filteredSuggestions = suggestions.filter((s) => {
    if (filter === 'ALL') return true;
    return s.status === filter;
  });

  const stats = {
    total: suggestions.length,
    pending: suggestions.filter((s) => s.status === 'PENDING').length,
    approved: suggestions.filter((s) => s.status === 'APPROVED').length,
    rejected: suggestions.filter((s) => s.status === 'REJECTED').length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Category Suggestions
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Review and moderate user-submitted category suggestions
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <button
            onClick={() => setFilter('ALL')}
            className={`p-4 rounded-xl border-2 transition-all ${
              filter === 'ALL'
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
            }`}
          >
            <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
          </button>
          <button
            onClick={() => setFilter('PENDING')}
            className={`p-4 rounded-xl border-2 transition-all ${
              filter === 'PENDING'
                ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
            }`}
          >
            <p className="text-sm text-gray-600 dark:text-gray-400">Pending</p>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pending}</p>
          </button>
          <button
            onClick={() => setFilter('APPROVED')}
            className={`p-4 rounded-xl border-2 transition-all ${
              filter === 'APPROVED'
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
            }`}
          >
            <p className="text-sm text-gray-600 dark:text-gray-400">Approved</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.approved}</p>
          </button>
          <button
            onClick={() => setFilter('REJECTED')}
            className={`p-4 rounded-xl border-2 transition-all ${
              filter === 'REJECTED'
                ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
            }`}
          >
            <p className="text-sm text-gray-600 dark:text-gray-400">Rejected</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.rejected}</p>
          </button>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading suggestions...</p>
            </div>
          ) : filteredSuggestions.length === 0 ? (
            <div className="p-8 text-center text-gray-600 dark:text-gray-400">
              No {filter !== 'ALL' ? filter.toLowerCase() : ''} suggestions found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Category Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Proposed By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredSuggestions.map((suggestion) => (
                    <tr key={suggestion.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {suggestion.name}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {suggestion.proposerUsername ?? suggestion.proposedBy}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            suggestion.status === 'PENDING'
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                              : suggestion.status === 'APPROVED'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }`}
                        >
                          {suggestion.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {new Date(suggestion.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {suggestion.status === 'PENDING' ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApprove(suggestion.id)}
                              disabled={moderating === suggestion.id}
                              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(suggestion.id)}
                              disabled={moderating === suggestion.id}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-500 dark:text-gray-500 text-xs">
                            {suggestion.status === 'APPROVED' ? 'Approved' : 'Rejected'}
                            {suggestion.decidedByUsername && ` by ${suggestion.decidedByUsername}`}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CategorySuggestionsSettings;
