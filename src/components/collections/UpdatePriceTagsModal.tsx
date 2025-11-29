import React, { useMemo, useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { brandApi } from '@/api/BrandApi';
import { toast } from 'react-toastify';
import TagPicker from '@/components/forms/TagPicker';
import TagsApi from '@/api/TagsApi';

interface Props {
  open: boolean;
  onClose: () => void;
  collectionId: string;
  currentMin?: number | null;
  currentMax?: number | null;
  currentTags?: string[];
  onUpdated?: (payload: { minPrice?: number | null; maxPrice?: number | null; tags?: string[] }) => void;
}

const UpdatePriceTagsModal: React.FC<Props> = ({ open, onClose, collectionId, currentMin, currentMax, currentTags = [], onUpdated }) => {
  const [minPrice, setMinPrice] = useState<number | ''>(currentMin ?? '');
  const [maxPrice, setMaxPrice] = useState<number | ''>(currentMax ?? '');
  const [tags, setTags] = useState<string[]>(currentTags);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMinPrice(currentMin ?? '');
    setMaxPrice(currentMax ?? '');
    setTags(currentTags ?? []);
  }, [open, currentMin, currentMax, currentTags]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const s = await TagsApi.getSuggestions(80);
        if (mounted) setTagSuggestions(s);
      } catch { /* ignore */ }
    })();
    return () => { mounted = false; };
  }, []);

  const canSave = useMemo(() => !saving, [saving]);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const nextMin = typeof minPrice === 'string' ? undefined : minPrice;
      const nextMax = typeof maxPrice === 'string' ? undefined : maxPrice;

      const payload = {
        minPrice: nextMin ?? null,
        maxPrice: nextMax ?? null,
        tags,
      };

      const res = await brandApi.updateCollection(collectionId, payload);
      if (res) {
        onUpdated?.(payload);
        toast.success('Collection updated');
        onClose();
      } else {
        toast.error('Failed to update collection');
      }
    } catch (e) {
      toast.error('Failed to update collection');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Update Price & Tags" size="sm">
      <div className="space-y-6">
        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
          <p>Update the base price and tags for this collection. To set a temporary discount, use the "Discount Sale" feature.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Min Price</label>
            <input 
              type="number" 
              value={minPrice} 
              onChange={(e) => setMinPrice(e.target.value === '' ? '' : Number(e.target.value))} 
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" 
              placeholder="₦0" 
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Max Price</label>
            <input 
              type="number" 
              value={maxPrice} 
              onChange={(e) => setMaxPrice(e.target.value === '' ? '' : Number(e.target.value))} 
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" 
              placeholder="₦0" 
            />
          </div>
        </div>
        
        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Tags</label>
          <TagPicker suggestions={tagSuggestions} value={tags} onChange={setTags} allowCustom max={10} />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
          <button 
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" 
            onClick={onClose} 
            disabled={saving}
          >
            Cancel
          </button>
          <button 
            className="px-6 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 transition-all transform active:scale-95" 
            onClick={handleSave} 
            disabled={!canSave}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default UpdatePriceTagsModal;
