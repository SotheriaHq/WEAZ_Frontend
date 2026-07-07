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
  const previewUrl =
    kind === 'video' ? buildVideoPreviewUrl(f) : '';
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
} | null>(null);

export const MediaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const urlRef = useRef<Map<string, string>>(new Map());
  const convertingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const it of state.items) {
      if (it.previewUrl?.startsWith('blob:')) {
        if (!urlRef.current.has(it.id)) {
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
  }, [state.items]);

  useEffect(() => {
    for (const it of state.items) {
      if (
        it.kind !== 'image' ||
        !it.file ||
        it.previewUrl ||
        convertingRef.current.has(it.id)
      ) {
        continue;
      }

      convertingRef.current.add(it.id);
      const itemId = it.id;
      const file = it.file;

      void (async () => {
        try {
          // Route on the file's REAL bytes, not its claimed type: Android
          // galleries hand over HEIC named .jpg, which no local strategy can
          // decode — normalize those on the server ONCE, at selection, so
          // preview, upload, and validation all use the same JPEG.
          const sniffedFormat = await sniffImageFormat(file);
          addClientDiagnostic('info', 'media-store', 'Sniffed selected file', {
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            sniffedFormat,
          });

          if (isUnreadableSniff(sniffedFormat)) {
            dispatch({
              type: 'setPreview',
              id: itemId,
              previewUrl: IMAGE_PREVIEW_UNAVAILABLE_DATA_URL,
            });
            return;
          }

          if (!isBrowserDisplayableSniff(sniffedFormat)) {
            const normalized = await getNormalizedImageFile(file);
            dispatch({
              type: 'setNormalized',
              id: itemId,
              file: normalized,
              previewUrl: URL.createObjectURL(normalized),
            });
            addClientDiagnostic('info', 'media-store', 'Normalized undecodable file on server', {
              fileName: file.name,
              sniffedFormat,
              normalizedSize: normalized.size,
            });
            return;
          }

          let previewUrl = await Promise.race([
            buildDisplayableImagePreview(file),
            new Promise<string>((_, reject) => {
              setTimeout(
                () => reject(new Error('Preview generation timed out')),
                PREVIEW_OVERALL_TIMEOUT_MS,
              );
            }),
          ]);

          // Android Chrome often accepts a raw data: URL from the canvas
          // fallback but cannot actually decode it in <img>. Probe before we
          // commit — otherwise LocalMediaPreview fails and we pay for a second
          // server transcode from every thumbnail + main preview surface.
          if (
            isPreviewUnavailableDataUrl(previewUrl) ||
            previewUrl.startsWith('data:')
          ) {
            try {
              await probeImagePreviewUrl(previewUrl);
            } catch {
              throw new Error('Local preview probe failed');
            }
          }

          dispatch({ type: 'setPreview', id: itemId, previewUrl });
        } catch (error) {
          console.warn('[useMediaStore] preview generation failed', error);
          addClientDiagnostic('warn', 'media-store', 'Local preview failed; trying server normalize', {
            fileName: file.name,
            error: error instanceof Error ? error.message : String(error),
          });
          // Last resort for browser-displayable files whose local pipeline
          // still failed (blocked canvas + undecodable data URL, OOM, ...).
          try {
            const normalized = await getNormalizedImageFile(file);
            dispatch({
              type: 'setNormalized',
              id: itemId,
              file: normalized,
              previewUrl: URL.createObjectURL(normalized),
            });
          } catch {
            dispatch({
              type: 'setPreview',
              id: itemId,
              previewUrl: IMAGE_PREVIEW_UNAVAILABLE_DATA_URL,
            });
          }
        } finally {
          convertingRef.current.delete(itemId);
        }
      })();
    }
  }, [state.items]);

  useEffect(() => {
    const map = urlRef.current;
    return () => {
      for (const url of map.values()) {
        revokeObjectPreviewUrl(url);
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