import React from 'react';

interface StoreStatsBarProps {
  freeShippingThreshold?: number;
  shipsFrom?: string;
  responseTime?: string;
  returnPolicy?: string;
}

/**
 * Store Stats Bar Component
 * Displays shipping, location, response time, and return policy info
 */
const StoreStatsBar: React.FC<StoreStatsBarProps> = ({
  freeShippingThreshold,
  shipsFrom = 'Lagos, Nigeria',
  responseTime = 'Within 24 hours',
  returnPolicy = '30-day returns',
}) => {
  return (
    <div className="bg-gray-50 dark:bg-[#0f0f0f] border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              🚚 Free Shipping
            </p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {freeShippingThreshold ? `Orders over $${freeShippingThreshold}` : 'Contact for rates'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              📍 Ships From
            </p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{shipsFrom}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              ⏱️ Response Time
            </p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{responseTime}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              ↩️ Return Policy
            </p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              <a href="#policies" className="text-purple-600 dark:text-purple-400 hover:underline">
                {returnPolicy}
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoreStatsBar;
