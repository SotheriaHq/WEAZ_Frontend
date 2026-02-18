import React from 'react';
import { Link2, Trash2 } from 'lucide-react';
import TagChip from '@/components/ui/Tag';
import { FrostedButton } from '@/components/ui/FrostedButton';

interface MetaPanelProps {
  title: string;
  description?: string | null;
  tags?: string[];
  owner?: { id: string; name?: string | null; username?: string | null; avatarUrl?: string | null } | null;
  stats?: { threads?: number; comments?: number; items?: number; views?: number };
  price?: { min?: number; max?: number };
  availabilityInStore?: boolean;
  visibility?: 'PUBLIC' | 'PRIVATE';
  isOwner?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

const formatCurrency = (n?: number) => {
  if (typeof n !== 'number' || isNaN(n)) return undefined;
  try { return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n); }
  catch { return `₦${Math.round(n).toLocaleString()}`; }
};

export const CollectionMetaPanel: React.FC<MetaPanelProps> = ({
  title,
  description,
  tags = [],
  owner,
  stats,
  price,
  availabilityInStore,
  visibility,
  isOwner,
  onEdit,
  onDelete,
}) => {
  const priceBand = (() => {
    const min = formatCurrency(price?.min);
    const max = formatCurrency(price?.max);
    if (min && max) return `${min} - ${max}`;
    if (min) return `${min}+`;
    if (max) return `Up to ${max}`;
    return undefined;
  })();

  return (
    <aside className="glass-panel rounded-2xl p-4 border border-white/20 bg-white/60 dark:bg-white/5 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold leading-tight">{title}</h1>
          {visibility && (
            <span className={`inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full border ${visibility === 'PUBLIC' ? 'text-emerald-700 border-emerald-300/60 bg-emerald-50' : 'text-amber-700 border-amber-300/60 bg-amber-50'} dark:border-white/10 dark:bg-white/10`}>{visibility === 'PUBLIC' ? 'Public' : 'Private'}</span>
          )}
        </div>
        {isOwner && (
          <div className="flex items-center gap-2">
            <FrostedButton size="sm" variant="ghost" onClick={onEdit}><span className="mr-1">✏️</span> Edit</FrostedButton>
            <FrostedButton size="sm" variant="outline" onClick={onDelete} className="!text-red-600 !border-red-300/60 hover:!bg-red-50 dark:!border-red-500/40 dark:hover:!bg-red-900/20"><Trash2 className="w-4 h-4"/> Delete</FrostedButton>
          </div>
        )}
      </div>

      {owner && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">By <span className="font-medium">{owner.name || owner.username || 'Brand'}</span></div>
      )}

      {description && (
        <p className="mt-3 text-sm text-gray-700 dark:text-gray-200 whitespace-pre-line">{description}</p>
      )}

      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.slice(0, 12).map((t) => (
            <TagChip key={t} label={`#${t}`} size="sm" />
          ))}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        {typeof stats?.items === 'number' && (
          <div className="rounded-lg bg-white/70 dark:bg-white/5 p-3 border border-white/20">
            <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Pieces</div>
            <div className="text-sm font-semibold">{stats.items}</div>
          </div>
        )}
        {typeof stats?.views === 'number' && (
          <div className="rounded-lg bg-white/70 dark:bg-white/5 p-3 border border-white/20">
            <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Views</div>
            <div className="text-sm font-semibold">{stats.views}</div>
          </div>
        )}
        {typeof stats?.comments === 'number' && (
          <div className="rounded-lg bg-white/70 dark:bg-white/5 p-3 border border-white/20">
            <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Comments</div>
            <div className="text-sm font-semibold">{stats.comments}</div>
          </div>
        )}
        {typeof stats?.threads === 'number' && (
          <div className="rounded-lg bg-white/70 dark:bg-white/5 p-3 border border-white/20">
            <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Threads</div>
            <div className="text-sm font-semibold">{stats.threads}</div>
          </div>
        )}
      </div>

      {(priceBand || availabilityInStore) && (
        <div className="mt-4 rounded-lg bg-white/70 dark:bg-white/5 p-3 border border-white/20">
          {priceBand && (
            <div className="text-xs"><span className="text-gray-500 dark:text-gray-400">Price band:</span> <span className="font-medium">{priceBand}</span></div>
          )}
          {availabilityInStore && (
            <div className="text-xs mt-1 text-emerald-700 dark:text-emerald-300">Available in physical store</div>
          )}
        </div>
      )}

      {!isOwner && (
        <div className="mt-4">
          <FrostedButton variant="primary" className="w-full">
            <Link2 className="w-4 h-4 mr-2"/> Thread
          </FrostedButton>
        </div>
      )}
    </aside>
  );
};

export default CollectionMetaPanel;
