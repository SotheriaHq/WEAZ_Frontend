import React, { useState, useEffect } from 'react';
import { RefreshCcw, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ui/useConfirm';

export const HiddenContentSettings: React.FC = () => {
  const [hiddenCount, setHiddenCount] = useState(0);
  const { confirm, ConfirmDialog } = useConfirm();

  useEffect(() => {
    const items = JSON.parse(localStorage.getItem('hiddenMarketItems') || '[]');
    setHiddenCount(items.length);
  }, []);

  const handleClearAll = async () => {
    const approved = await confirm({
      title: 'Unhide all content?',
      message: 'This will restore all items you previously hid from your feed.',
      confirmText: 'Unhide all',
      cancelText: 'Cancel',
      isDestructive: true,
    });
    if (!approved) return;
    localStorage.removeItem('hiddenMarketItems');
    setHiddenCount(0);
    toast.success('All hidden content has been restored.');
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      {ConfirmDialog}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400">
          <EyeOff className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Hidden Content</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage content you've chosen to hide from your feed.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              {hiddenCount} {hiddenCount === 1 ? 'Item' : 'Items'} Hidden
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              These items will not appear in your Market feed.
            </p>
          </div>

          {hiddenCount > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors font-medium text-sm"
            >
              <RefreshCcw className="w-4 h-4" />
              Unhide All
            </button>
          )}
        </div>

        {hiddenCount === 0 && (
          <div className="px-6 pb-6 text-center">
            <p className="text-sm text-gray-400 italic">
              You haven't hidden any content yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HiddenContentSettings;
