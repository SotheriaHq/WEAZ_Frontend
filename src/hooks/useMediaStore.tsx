import React, { createContext, useCallback, useContext, useReducer, useEffect, useRef, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { MediaItem, MediaItemKind } from '../types/media';
import { normalizeMediaViewSlot } from '@/utils/contentIntegrity';

type State = { items: MediaItem[] };

type Action =
  | { type: 'add'; files: File[]; maxItems?: number }
  | { type: 'remove'; id: string }
  | { type: 'clear' }
  | { type: 'set'; items: MediaItem[] }
  | { type: 'reorder'; items: MediaItem[] };

const initialState: State = { items: [] };

const genId = () => {
  try {
    const g = (globalThis as unknown) as { crypto?: { randomUUID?: () => string } };
    if (g && g.crypto && typeof g.crypto.randomUUID === 'function') return g.crypto.randomUUID();
  } catch {
    // ignore
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
};

function detectKind(file: File): MediaItemKind {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return 'image';
}

function createItemFromFile(f: File, index = 0): MediaItem {
  const id = genId();
  const previewUrl = URL.createObjectURL(f);
  const kind = detectKind(f);
  return { id, file: f, previewUrl, kind, viewSlot: normalizeMediaViewSlot(null, index) };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'add': {
      const remaining =
        typeof action.maxItems === 'number'
          ? Math.max(0, action.maxItems - state.items.length)
          : action.files.length;
      const newItems = action.files
        .slice(0, remaining)
        .map((file, index) => createItemFromFile(file, state.items.length + index));
      return { items: [...state.items, ...newItems] };
    }
    case 'remove':
      return { items: state.items.filter((it) => it.id !== action.id) };
    case 'clear':
      return { items: [] };
    case 'set':
      return { items: action.items };
    case 'reorder':
      return { items: action.items };
    default:
      return state;
  }
}

const MediaContext = createContext<{
  state: State;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export const MediaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const urlRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    for (const it of state.items) {
      if (it.previewUrl && !urlRef.current.has(it.id)) urlRef.current.set(it.id, it.previewUrl);
    }

    const keep = new Set(state.items.map((it) => it.id));
  const map = urlRef.current;
    for (const k of Array.from(map.keys())) {
      if (!keep.has(k)) {
        const u = map.get(k);
        if (u && u.startsWith('blob:')) URL.revokeObjectURL(u);
        map.delete(k);
      }
    }
  }, [state.items]);

  useEffect(() => {
    const map = urlRef.current;
    return () => {
      const urls = Array.from(map.values());
      for (const u of urls) {
        if (u.startsWith('blob:')) URL.revokeObjectURL(u);
      }
      map.clear();
    };
  }, []);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>;
};

export function useMediaStore() {
  const ctx = useContext(MediaContext);
  if (!ctx) throw new Error('useMediaStore must be used within MediaProvider');
  const { state, dispatch } = ctx;

  const addFiles = useCallback(
    (files: File[], maxItems?: number) => dispatch({ type: 'add', files, maxItems }),
    [dispatch],
  );
  const remove = useCallback((id: string) => dispatch({ type: 'remove', id }), [dispatch]);
  const clear = useCallback(() => dispatch({ type: 'clear' }), [dispatch]);
  const set = useCallback((items: MediaItem[]) => dispatch({ type: 'set', items }), [dispatch]);
  const reorder = useCallback((items: MediaItem[]) => dispatch({ type: 'reorder', items }), [dispatch]);

  return useMemo(() => ({
    items: state.items,
    addFiles,
    remove,
    clear,
    set,
    reorder,
  }), [addFiles, clear, remove, reorder, set, state.items]);
}

export default useMediaStore;
