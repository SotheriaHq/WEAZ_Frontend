import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { brandApi } from '@/api/BrandApi';
import { toast } from 'sonner';
import { Calendar, Clock } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  collectionId: string;
  currentMin?: number | null;
  currentMax?: number | null;
  onUpdated?: (payload: { saleMinPrice?: number | null; saleMaxPrice?: number | null; saleStartAt?: string | null; saleEndAt?: string | null }) => void;
}

const DiscountSaleModal: React.FC<Props> = ({ open, onClose, collectionId, currentMin, currentMax, onUpdated }) => {
  const [saleMin, setSaleMin] = useState<number | ''>('');
  const [saleMax, setSaleMax] = useState<number | ''>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      // Reset fields on open
      setSaleMin('');
      setSaleMax('');
      // Default start to now (minus 1 minute to ensure immediate start)
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset() - 1);
      setStartDate(now.toISOString().slice(0, 16));
      // Default end to 24h from now
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      setEndDate(tomorrow.toISOString().slice(0, 16));
    }
  }, [open]);

  const handleSave = async () => {
    if (!startDate || !endDate) {
      toast.error('Please set a start and end time');
      return;
    }
    if (new Date(endDate) <= new Date(startDate)) {
      toast.error('End time must be after start time');
      return;
    }
    if (saleMin === '' && saleMax === '') {
      toast.error('Please set at least one sale price');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        saleMinPrice: saleMin === '' ? null : Number(saleMin),
        saleMaxPrice: saleMax === '' ? null : Number(saleMax),
        saleStartAt: new Date(startDate).toISOString(),
        saleEndAt: new Date(endDate).toISOString(),
      };

      const res = await brandApi.updateCollection(collectionId, payload);
      if (res) {
        onUpdated?.(payload);
        toast.success('Discount sale initiated');
        onClose();
      } else {
        toast.error('Failed to initiate sale');
      }
    } catch {
      toast.error('Failed to initiate sale');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Initiate Discount Sale" size="sm">
      <div className="space-y-5">
        <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/30 text-xs text-purple-800 dark:text-purple-200">
          <p>Set a discounted price for a limited time. The original price will be shown as struck through.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
              Original Min
            </label>
            <div className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 text-sm">
              {currentMin ? `₦${currentMin.toLocaleString()}` : 'N/A'}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
              Original Max
            </label>
            <div className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 text-sm">
              {currentMax ? `₦${currentMax.toLocaleString()}` : 'N/A'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
              Sale Min Price
            </label>
            <input
              type="number"
              value={saleMin}
              onChange={(e) => setSaleMin(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              placeholder="₦0"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
              Sale Max Price
            </label>
            <input
              type="number"
              value={saleMax}
              onChange={(e) => setSaleMax(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              placeholder="₦0"
            />
          </div>
        </div>

        <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-800">
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Start Time
            </label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
              <Clock className="w-3 h-3" /> End Time
            </label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 transition-all transform active:scale-95"
          >
            {saving ? 'Initiating...' : 'Initiate Sale'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default DiscountSaleModal;
