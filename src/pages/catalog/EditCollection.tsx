import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { brandApi } from '@/api/BrandApi';
import { Calendar } from 'primereact/calendar';
import { toast } from 'react-toastify';

const EditCollection: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(true);
  const [detail, setDetail] = React.useState<any | null>(null);
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [minPrice, setMinPrice] = React.useState<number | ''>('');
  const [maxPrice, setMaxPrice] = React.useState<number | ''>('');
  const [saleMin, setSaleMin] = React.useState<number | ''>('');
  const [saleMax, setSaleMax] = React.useState<number | ''>('');
  const [saleRange, setSaleRange] = React.useState<[Date | null, Date | null] | null>(null);
  const [tags, setTags] = React.useState<string>('');
  const [saving, setSaving] = React.useState(false);
  const [visibility, setVisibility] = React.useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      if (!id) return;
      setLoading(true);
      const d = await brandApi.getCollectionDetail(id);
      if (!mounted) return;
      setDetail(d);
      setTitle(d?.title ?? '');
      setDescription(d?.description ?? '');
      setMinPrice(d?.minPrice ?? '');
      setMaxPrice(d?.maxPrice ?? '');
      setSaleMin(d?.saleMinPrice ?? '');
      setSaleMax(d?.saleMaxPrice ?? '');
      if (d?.saleStartAt || d?.saleEndAt) {
        setSaleRange([d?.saleStartAt ? new Date(d.saleStartAt) : null, d?.saleEndAt ? new Date(d.saleEndAt) : null]);
      }
      setTags(Array.isArray(d?.tags) ? d.tags.join(', ') : '');
      setVisibility((d?.visibility === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC'));
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [id]);

  const save = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const payload: any = {
        title,
        description,
        minPrice: typeof minPrice === 'string' ? undefined : minPrice,
        maxPrice: typeof maxPrice === 'string' ? undefined : maxPrice,
        saleMinPrice: typeof saleMin === 'string' ? undefined : saleMin,
        saleMaxPrice: typeof saleMax === 'string' ? undefined : saleMax,
        saleStartAt: saleRange?.[0]?.toISOString() ?? null,
        saleEndAt: saleRange?.[1]?.toISOString() ?? null,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        visibility,
      };
      const res = await brandApi.updateCollection(id, payload);
      if (res) {
        toast.success('Collection updated');
        navigate(-1);
      } else {
        toast.error('Failed to update');
      }
    } catch {
      toast.error('Failed to update');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Loading…</div>;
  if (!detail) return <div className="p-6">Not found</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <h1 className="text-xl font-bold mb-4">Edit Collection</h1>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-gray-600 dark:text-gray-300">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg bg-white/70 dark:bg-white/5 border border-gray-300 dark:border-gray-700" />
        </div>
        <div>
          <label className="text-xs text-gray-600 dark:text-gray-300">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg bg-white/70 dark:bg-white/5 border border-gray-300 dark:border-gray-700" rows={4} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-300">Min Price</label>
            <input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value === '' ? '' : Number(e.target.value))} className="mt-1 w-full px-3 py-2 rounded-lg bg-white/70 dark:bg-white/5 border border-gray-300 dark:border-gray-700" />
          </div>
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-300">Max Price</label>
            <input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value === '' ? '' : Number(e.target.value))} className="mt-1 w-full px-3 py-2 rounded-lg bg-white/70 dark:bg-white/5 border border-gray-300 dark:border-gray-700" />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-600 dark:text-gray-300">Visibility</label>
          <div className="mt-1 inline-flex rounded-full border border-gray-300 dark:border-gray-700 bg-white/70 dark:bg-white/5 p-1">
            {(['PUBLIC','PRIVATE'] as const).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v)}
                className={`px-3 py-1 text-xs rounded-full ${visibility===v ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white' : 'text-gray-700 dark:text-gray-300'}`}
                disabled={saving}
              >{v === 'PUBLIC' ? 'Public' : 'Private'}</button>
            ))}
          </div>
          {visibility === 'PRIVATE' && (
            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">Private collections require viewers to request access. If rejected they must wait 72 hours before re-requesting.</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-300">Discount Min</label>
            <input type="number" value={saleMin} onChange={(e) => setSaleMin(e.target.value === '' ? '' : Number(e.target.value))} className="mt-1 w-full px-3 py-2 rounded-lg bg-white/70 dark:bg-white/5 border border-gray-300 dark:border-gray-700" />
          </div>
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-300">Discount Max</label>
            <input type="number" value={saleMax} onChange={(e) => setSaleMax(e.target.value === '' ? '' : Number(e.target.value))} className="mt-1 w-full px-3 py-2 rounded-lg bg-white/70 dark:bg-white/5 border border-gray-300 dark:border-gray-700" />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-600 dark:text-gray-300">Discount Period</label>
          <div className="mt-1">
            <Calendar selectionMode="range" value={saleRange as any} onChange={(e) => setSaleRange(e.value as any)} readOnlyInput showIcon placeholder="Select date range" />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-600 dark:text-gray-300">Tags (comma separated)</label>
          <input value={tags} onChange={(e) => setTags(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg bg-white/70 dark:bg-white/5 border border-gray-300 dark:border-gray-700" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button className="px-3 py-2 rounded-lg border bg-white/70 dark:bg-white/5" onClick={() => navigate(-1)} disabled={saving}>Cancel</button>
          <button className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white" onClick={save} disabled={saving}>Save</button>
        </div>
      </div>
    </div>
  );
};

export default EditCollection;
