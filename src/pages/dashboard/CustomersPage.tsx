import React from 'react';
import { Users, Search, UserPlus } from 'lucide-react';

/**
 * Customers Page (Studio)
 * Shows list of customers who have ordered from the store
 */
const CustomersPage: React.FC = () => {
  // Mock empty state for now
  const customers: any[] = [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Customers
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            View and manage your store customers
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search customers..."
              className="pl-10 pr-4 py-2 bg-gray-100 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-700/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 w-64"
            />
          </div>
        </div>
      </div>

      {/* Empty State */}
      {customers.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900/50 rounded-2xl border border-gray-100 dark:border-zinc-800 p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-full bg-purple-500/10 flex items-center justify-center mb-6">
              <Users className="w-10 h-10 text-purple-500" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No customers yet
            </h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-6">
              When customers place orders from your store, they'll appear here. 
              Start by adding products and sharing your store!
            </p>
            <div className="flex items-center gap-3">
              <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-colors flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                Share Store
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900/50 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden">
          {/* Customers table would go here */}
          <p className="p-6 text-gray-500">Customer list coming soon...</p>
        </div>
      )}
    </div>
  );
};

export default CustomersPage;
