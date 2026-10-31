import React, { createContext, useCallback, useContext, useReducer, useEffect, useRef, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { MediaItem, MediaItemKind } from '../types/media';
import { normalizeMediaViewSlot } from '@/utils/contentIntegrity';
import {
  buildDisplayableImagePreview,
  buildVideoPreviewUrl,
  IMAGE_PREVIEW_UNAVAILABLE_DATA_URL,
  isPreviewUnavailableDataUrl,
  PREVIEW_STRATEGY_TIMEOUT_MS,
  probeImagePreviewUrl,
  revokeObjectPreviewUrl,
} from '@/utils/imagePreview';
import {
  sniffImageFormat,
  isBrowserDisplayableSniff,
  isUnreadableSniff,
} from '@/utils/imageByteSniff';
import { getNormalizedImageFile } from '@/api/UploadApi';
import { addClientDiagnostic } from '@/utils/clientDiagnostics';

const PREVIEW_OVERALL_TIMEOUT_MS = PREVIEW_STRATEGY_TIMEOUT_MS * 3 + 5_000;

type State = { items: MediaItem[] };

type Action =
  | { type: 'add'; files: File[]; maxItems?: number }
  | { type: 'remove'; id: string }
  | { type: 'clear' }
  | { type: 'set'; items: MediaItem[] }
  | { type: 'reorder'; items: MediaItem[] }
  | { type: 'setPreview'; id: string; previewUrl: string }
  | { type: 'setNormalized'; id: string; file: File; previewUrl: string };

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
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('image/')) return 'image';
  return 'image';
}

function createItemFromFile(f: File, index = 0): MediaItem {
  const id = genId();
  const kind = detectKind(f);
  // Instant local blob preview for images so the form paints on the next frame.
  // Background effect upgrades HEIC/large mobile photos when needed.
  const previewUrl =
    kind === 'video'
      ? buildVideoPreviewUrl(f)
      : URL.createObjectURL(f);
  return { id, file: f, previewUrl, kind, viewSlot: normalizeMediaViewSlot(null, index) };
}

/**
 * View slots are POSITIONAL: slot N belongs to whatever image sits at index N.
 * That is already how the UI presents them ("1. Front, 2. Back, 3. Left...").
 *
 * They used to be stamped onto an item once, at add time, and never revisited —
 * so any structural edit desynced slot from position. Deleting the first image
 * left the survivors still tagged Back/Left/Right with NOTHING tagged Front, and
 * a replacement file was slotted by its append position, so it could not become
 * Front either: the required slot was simply unreachable and the design could
 * never satisfy "fill Front, Back, Left, and Right".
 *
 * Re-deriving after every structural change keeps slot and position in agreement
 * by construction, and makes drag-to-reorder double as slot assignment.
 *
 * Item identity is preserved when the slot is already correct, so this does not
 * churn renders or invalidate preview URLs.
 */
const withPositionalViewSlots = (items: MediaItem[]): MediaItem[] =>
  items.map((item, index) => {
    const viewSlot = normalizeMediaViewSlot(null, index);
    return item.viewSlot === viewSlot ? item : { ...item, viewSlot };
  });

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
      return { items: withPositionalViewSlots([...state.items, ...newItems]) };
    }
    case 'remove':
      return {
        items: withPositionalViewSlots(state.items.filter((it) => it.id !== action.id)),
      };
    case 'clear':
      return { items: [] };
    // `set` hydrates from the server in edit mode and must preserve the slots the
    // server actually stored; only user-driven structural edits re-derive.
    case 'set':
      return { items: action.items };
    case 'reorder':
      return { items: withPositionalViewSlots(action.items) };
    case 'setPreview':
      return {
        items: state.items.map((it) =>
          it.id === action.id ? { ...it, previewUrl: action.previewUrl } : it,
        ),
      };
    case 'setNormalized':
      // The normalized JPEG replaces the original file: preview, upload
      // preprocessing, and size validation all consume the same bytes.
      return {
        items: state.items.map((it) =>
          it.id === action.id
            ? { ...it, file: action.file, previewUrl: action.previewUrl }
            : it,
        ),
      };
    default:
      return state;
  }
}

const MediaContext = createContext<{
  state: State;
  dispatch: React.Dispatch<Action>;
  keepPreview: (id: string) => string | undefined;
} | null>(null);

export const MediaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const urlRef = useRef<Map<string, string>>(new Map());
  const keptPreviewsRef = useRef<Set<string>>(new Set());
  const convertingRef = useRef<Set<string>>(new Set());
  const processedRef = useRef<Map<string, File>>(new Map());
  const mountedRef = useRef(true);
  const itemsRef = useRef(state.items);
  itemsRef.current = state.items;
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    for (const it of state.items) {
      if (it.previewUrl?.startsWith('blob:')) {
        if (keptPreviewsRef.current.has(it.previewUrl)) continue;
        const previous = urlRef.current.get(it.id);
        if (previous !== it.previewUrl) {
          revokeObjectPreviewUrl(previous);
          urlRef.current.set(it.id, it.previewUrl);
        }
        continue;
      }

      const tracked = urlRef.current.get(it.id);
      if (tracked?.startsWith('blob:')) {
        revokeObjectPreviewUrl(tracked);
        urlRef.current.delete(it.id);
      }
    }

    const keep = new Set(state.items.map((it) => it.id));
    const map = urlRef.current;
    for (const k of Array.from(map.keys())) {
      if (!keep.has(k)) {
        revokeObjectPreviewUrl(map.get(k));
        map.delete(k);
      }
    }
    for (const id of processedRef.current.keys()) {
      if (!keep.has(id)) processedRef.current.delete(id);
    }
  }, [state.items]);

  useEffect(() => {
    for (const item of state.items) {
      if (item.kind !== 'image' || !item.file || convertingRef.current.has(item.id) || processedRef.current.get(item.id) === item.file) continue;
      const file = item.file;
      const previousPreview = item.previewUrl;
      convertingRef.current.add(item.id);
      const isCurrent = () => mountedRef.current && itemsRef.current.some(
        (entry) => entry.id === item.id && entry.file === file,
      );
      const commit = (action: Extract<Action, { type: 'setPreview' | 'setNormalized' }>) => {
        if (!isCurrent()) {
          if (action.previewUrl !== previousPreview) revokeObjectPreviewUrl(action.previewUrl);
          return;
        }
        processedRef.current.set(item.id, action.type === 'setNormalized' ? action.file : file);
        dispatch(action);
      };
      void (async () => {
        let displayable = false;
        try {
          const format = await sniffImageFormat(file);
          if (!isCurrent()) return;
          if (isUnreadableSniff(format)) {
            commit({ type: 'setPreview', id: item.id, previewUrl: IMAGE_PREVIEW_UNAVAILABLE_DATA_URL });
            return;
          }
          displayable = isBrowserDisplayableSniff(format);
          // Native browser decoding is the fast path on phones, tablets and
          // laptops. File size or pointer type alone must never trigger a
          // network transcode or replace an already displayable source file.
          if (displayable && previousPreview?.startsWith('blob:')) {
            try {
              await probeImagePreviewUrl(previousPreview);
              if (isCurrent()) processedRef.current.set(item.id, file);
              addClientDiagnostic('info', 'media-store', 'Local preview decoded without server conversion', { fileSize: file.size, fileType: file.type });
              return;
            } catch { /* Try local conversion. */ }
          }
          if (!isCurrent()) return;
          if (displayable) {
            let timer: ReturnType<typeof setTimeout> | undefined;
            const local = buildDisplayableImagePreview(file);
            // A timed-out encode can still finish and allocate an object URL.
            let abandoned = false;
            void local.then((url) => { if (abandoned) revokeObjectPreviewUrl(url); }, () => undefined);
            try {
              const previewUrl = await Promise.race([
                local,
                new Promise<string>((_, reject) => {
                  timer = setTimeout(() => { abandoned = true; reject(new Error('Preview generation timed out')); }, PREVIEW_OVERALL_TIMEOUT_MS);
                }),
              ]);
              if (!isPreviewUnavailableDataUrl(previewUrl)) {
                commit({ type: 'setPreview', id: item.id, previewUrl });
                return;
              }
            } finally { if (timer !== undefined) clearTimeout(timer); }
          }
        } catch { /* Server conversion is the final decode fallback. */ }
        try {
          if (!isCurrent()) return;
          addClientDiagnostic('info', 'media-store', 'Using server preview decode fallback', { fileSize: file.size, fileType: file.type });
          const normalized = await getNormalizedImageFile(file);
          if (!isCurrent()) return;
          const previewUrl = URL.createObjectURL(normalized);
          // JPEG/PNG/WebP preview recovery must not replace the upload master.
          // Undecodable input formats retain the existing normalization flow.
          if (displayable) commit({ type: 'setPreview', id: item.id, previewUrl });
          else commit({ type: 'setNormalized', id: item.id, file: normalized, previewUrl });
        } catch {
          if (isCurrent()) processedRef.current.set(item.id, file);
          if (!previousPreview?.startsWith('blob:')) {
            commit({ type: 'setPreview', id: item.id, previewUrl: IMAGE_PREVIEW_UNAVAILABLE_DATA_URL });
          }
        }
      })().finally(() => { convertingRef.current.delete(item.id); });
    }
  }, [state.items]);

  useEffect(() => {
    const map = urlRef.current;
    const processed = processedRef.current;
    return () => {
      for (const url of map.values()) {
        revokeObjectPreviewUrl(url);
      }
      map.clear();
      processed.clear();
    };
  }, []);

  // Hands a preview to something that outlives this store, without a second
  // decode. Its URL leaves tracking, so the caller now owns revoking it.
  const keepPreview = useCallback((id: string) => {
    const url = itemsRef.current.find((item) => item.id === id)?.previewUrl;
    if (url?.startsWith('blob:')) {
      keptPreviewsRef.current.add(url);
      urlRef.current.delete(id);
    }
    return url;
  }, []);

  const value = useMemo(() => ({ state, dispatch, keepPreview }), [keepPreview, state]);
  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>;
};

export function useMediaStore() {
  const ctx = useContext(MediaContext);
  if (!ctx) throw new Error('useMediaStore must be used within MediaProvider');
  const { state, dispatch, keepPreview } = ctx;

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
    keepPreview,
  }), [addFiles, clear, keepPreview, remove, reorder, set, state.items]);
}

export default useMediaStore;
