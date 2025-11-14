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
  onUpdated?: (payload: { minPrice?: number | null; maxPrice?: number | null; tags?: string[]; saleMinPrice?: number | null; saleMaxPrice?: number | null }) => void;
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
      // If user lowered the price compared to current, treat as sale to preserve original price
      const nextMin = typeof minPrice === 'string' ? undefined : minPrice;
      const nextMax = typeof maxPrice === 'string' ? undefined : maxPrice;
      const saleMin = currentMin != null && nextMin != null && nextMin < currentMin ? nextMin : undefined;
      const saleMax = currentMax != null && nextMax != null && nextMax < currentMax ? nextMax : undefined;

      const payload: any = {
        // Always allow tag updates
        tags,
      };
      if (saleMin != null || saleMax != null) {
        // keep base prices, add sale fields
        payload.saleMinPrice = saleMin ?? null;
        payload.saleMaxPrice = saleMax ?? null;
      } else {
        // regular price update
        payload.minPrice = nextMin ?? null;
        payload.maxPrice = nextMax ?? null;
      }

      const res = await brandApi.updateCollection(collectionId, payload as any);
      if (res) {
        onUpdated?.({ minPrice: nextMin ?? null, maxPrice: nextMax ?? null, tags, saleMinPrice: payload.saleMinPrice, saleMaxPrice: payload.saleMaxPrice });
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
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-300">Min Price</label>
            <input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value === '' ? '' : Number(e.target.value))} className="mt-1 w-full px-3 py-2 rounded-lg bg-white/70 dark:bg-white/5 border border-gray-300 dark:border-gray-700" placeholder="₦0" />
          </div>
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-300">Max Price</label>
            <input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value === '' ? '' : Number(e.target.value))} className="mt-1 w-full px-3 py-2 rounded-lg bg-white/70 dark:bg-white/5 border border-gray-300 dark:border-gray-700" placeholder="₦0" />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-600 dark:text-gray-300 mb-1 block">Tags</label>
          <TagPicker suggestions={tagSuggestions} value={tags} onChange={setTags} allowCustom max={10} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button className="px-3 py-2 rounded-lg border bg-white/70 dark:bg-white/5" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white" onClick={handleSave} disabled={!canSave}>Save</button>
        </div>
      </div>
    </Modal>
  );
};

export default UpdatePriceTagsModal;
