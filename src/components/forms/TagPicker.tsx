import React, { useMemo, useState } from 'react';
import { normalizeTag, validateTag, tagExists, TAG_CONFIG } from '@/utils/tagValidator';

interface Props {
  suggestions: string[];
  value: string[];
  onChange: (tags: string[]) => void;
  allowCustom?: boolean;
  max?: number;
}

type VariantKey =
  | 'SLATE'
  | 'FUCHSIA'
  | 'BLUE'
  | 'EMERALD'
  | 'AMBER'
  | 'ROSE'
  | 'VIOLET'
  | 'CYAN'
  | 'TEAL'
  | 'LIME'
  | 'ORANGE'
  | 'INDIGO'
  | 'SKY';

const VARIANTS: Record<VariantKey, { border: string; bgActive: string; text: string }> = {
  SLATE:   { border: 'border-slate-300/80 dark:border-slate-400/60',   bgActive: 'bg-slate-500/20 backdrop-blur-md',   text: 'text-gray-900 dark:text-white' },
  FUCHSIA: { border: 'border-fuchsia-300/80 dark:border-fuchsia-400/60', bgActive: 'bg-fuchsia-500/20 backdrop-blur-md', text: 'text-gray-900 dark:text-white' },
  BLUE:    { border: 'border-blue-300/80 dark:border-blue-400/60',     bgActive: 'bg-blue-500/20 backdrop-blur-md',    text: 'text-gray-900 dark:text-white' },
  EMERALD: { border: 'border-emerald-300/80 dark:border-emerald-400/60', bgActive: 'bg-emerald-500/20 backdrop-blur-md', text: 'text-gray-900 dark:text-white' },
  AMBER:   { border: 'border-amber-300/80 dark:border-amber-400/60',   bgActive: 'bg-amber-500/20 backdrop-blur-md',   text: 'text-gray-900 dark:text-white' },
  ROSE:    { border: 'border-rose-300/80 dark:border-rose-400/60',     bgActive: 'bg-rose-500/20 backdrop-blur-md',    text: 'text-gray-900 dark:text-white' },
  VIOLET:  { border: 'border-violet-300/80 dark:border-violet-400/60', bgActive: 'bg-violet-500/20 backdrop-blur-md',  text: 'text-gray-900 dark:text-white' },
  CYAN:    { border: 'border-cyan-300/80 dark:border-cyan-400/60',     bgActive: 'bg-cyan-500/20 backdrop-blur-md',    text: 'text-gray-900 dark:text-white' },
  TEAL:    { border: 'border-teal-300/80 dark:border-teal-400/60',     bgActive: 'bg-teal-500/20 backdrop-blur-md',    text: 'text-gray-900 dark:text-white' },
  LIME:    { border: 'border-lime-300/80 dark:border-lime-400/60',     bgActive: 'bg-lime-500/20 backdrop-blur-md',    text: 'text-gray-900 dark:text-white' },
  ORANGE:  { border: 'border-orange-300/80 dark:border-orange-400/60', bgActive: 'bg-orange-500/20 backdrop-blur-md',  text: 'text-gray-900 dark:text-white' },
  INDIGO:  { border: 'border-indigo-300/80 dark:border-indigo-400/60', bgActive: 'bg-indigo-500/20 backdrop-blur-md',  text: 'text-gray-900 dark:text-white' },
  SKY:     { border: 'border-sky-300/80 dark:border-sky-400/60',       bgActive: 'bg-sky-500/20 backdrop-blur-md',     text: 'text-gray-900 dark:text-white' },
};

const CHIP_BASE = 'px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all duration-200 border-2 backdrop-blur-lg';

const Chip: React.FC<{ active?: boolean; onClick?: () => void; color: VariantKey } & React.PropsWithChildren> = ({ active, onClick, children, color }) => {
  const v = VARIANTS[color] ?? VARIANTS.SLATE;
  const activeCls = `${v.bgActive} ${v.text} ${v.border} ring-2 ring-black/10 dark:ring-white/30`;
  const idleCls = `bg-transparent ${v.text} ${v.border} opacity-80 hover:opacity-100`;
  return (
    <button type="button" onClick={onClick} className={`${CHIP_BASE} ${active ? activeCls : idleCls}`}>
      {children}
    </button>
  );
};

const TagPicker: React.FC<Props> = ({ suggestions, value, onChange, allowCustom = true, max = TAG_CONFIG.MAX_TAGS_PER_COLLECTION }) => {
  const [query, setQuery] = useState('');
  const [newTagColor, setNewTagColor] = useState<VariantKey>('SLATE');
  const [colorMap, setColorMap] = useState<Record<string, VariantKey>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = suggestions.filter((t) => t && typeof t === 'string').map((t) => t.trim()).filter(Boolean);
    const uniq = Array.from(new Set(base));
    return q.length ? uniq.filter((t) => t.toLowerCase().includes(q)) : uniq;
  }, [suggestions, query]);

  const palette: VariantKey[] = ['SLATE', 'FUCHSIA', 'BLUE', 'EMERALD', 'AMBER', 'ROSE', 'VIOLET', 'CYAN', 'TEAL', 'LIME', 'ORANGE', 'INDIGO', 'SKY'];
  const pickColor = (tag: string): VariantKey => {
    if (colorMap[tag]) return colorMap[tag];
    let sum = 0;
    for (let i = 0; i < tag.length; i++) sum = (sum + tag.charCodeAt(i)) % 997;
    return palette[sum % palette.length];
  };

  const toggle = (tag: string) => {
    const normalized = normalizeTag(tag);
    if (!normalized) return;
    
    const validation = validateTag(normalized);
    if (!validation.valid) return; // silently ignore invalid
    
    if (tagExists(normalized, value)) {
      // Remove the tag (case-insensitive match)
      onChange(value.filter((x) => normalizeTag(x) !== normalized));
    } else if (value.length < max) {
      onChange([...value, normalized]);
    }
  };

  const addCustom = () => {
    const normalized = normalizeTag(query);
    if (!normalized) return;
    
    const validation = validateTag(normalized);
    if (!validation.valid) {
      setQuery('');
      alert(validation.error || 'Invalid tag format');
      return;
    }
    
    if (tagExists(normalized, value)) {
      setQuery('');
      return; // Already exists
    }
    
    if (value.length < max) {
      onChange([...value, normalized]);
      setColorMap((m) => ({ ...m, [normalized]: newTagColor }));
    }
    setQuery('');
  };

  return (
    <div className="space-y-3 max-w-full">
      <div className="flex items-center gap-2 max-w-full">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search or add tag"
          className="flex-1 min-w-0 rounded-md bg-black/5 dark:bg-white/10 border border-slate-300/70 dark:border-white/20 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-white/60 focus:outline-none focus:ring-1 focus:ring-slate-400/60 dark:focus:ring-white/40"
        />
        {allowCustom && (
          <button
            type="button"
            onClick={addCustom}
            className="px-3 py-2 rounded-md bg-black/5 dark:bg-white/15 border border-slate-300/70 dark:border-white/30 text-gray-900 dark:text-white text-sm hover:bg-black/10 dark:hover:bg-white/25 flex-none"
          >
            Add
          </button>
        )}
      </div>

      {allowCustom && (
        <div className="flex flex-wrap gap-2 max-w-full">
          {palette.map((k) => (
            <button
              key={k}
              type="button"
              aria-label={`Select ${k} color`}
              className={`h-5 w-5 rounded-full border ${VARIANTS[k].border} ${VARIANTS[k].bgActive} ${newTagColor === k ? 'ring-2 ring-offset-1 ring-slate-400 dark:ring-white/50' : ''}`}
              onClick={() => setNewTagColor(k)}
            />
          ))}
        </div>
      )}

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((t) => (
            <Chip key={t} color={pickColor(t)} active onClick={() => toggle(t)}>
              #{t}
            </Chip>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 max-w-full">
        {filtered.slice(0, 80).map((t) => (
          <Chip key={t} color={pickColor(t)} active={tagExists(t, value)} onClick={() => toggle(t)}>
            #{t}
          </Chip>
        ))}
        {filtered.length === 0 && (
          <span className="text-xs text-gray-600 dark:text-white/70">No matching tags</span>
        )}
      </div>
      <p className="text-[11px] text-gray-600 dark:text-white/60">Select up to {max} single-word tags (letters, numbers, -, _, .).</p>
    </div>
  );
};

export default TagPicker;
