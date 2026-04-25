import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

type Key = string; // `${contentType}:${contentId}`

interface ItemState {
  threadedByMe: boolean;
  threadCount: number;
  commentCount: number;
  collabCount: number;
}

interface EngagementState { items: Record<Key, ItemState>; }

const initialState: EngagementState = { items: {} };

function key(t: string, id: string) { return `${t}:${id}`; }

function ensureItem(state: EngagementState, k: Key): ItemState {
  if (!state.items[k]) {
    state.items[k] = { threadedByMe: false, threadCount: 0, commentCount: 0, collabCount: 0 };
  }
  return state.items[k];
}

export const engagementSlice = createSlice({
  name: 'engagement',
  initialState,
  reducers: {
    // Initialize engagement state for a piece of content
    setEngagementState: (state, action: PayloadAction<{
      contentType: string;
      contentId: string;
      threadedByMe?: boolean;
      threadCount?: number;
      commentCount?: number;
      collabCount?: number;
    }>) => {
      const k = key(action.payload.contentType, action.payload.contentId);
      const item = ensureItem(state, k);
      if (action.payload.threadedByMe !== undefined) item.threadedByMe = action.payload.threadedByMe;
      if (action.payload.threadCount !== undefined) item.threadCount = action.payload.threadCount;
      if (action.payload.commentCount !== undefined) item.commentCount = action.payload.commentCount;
      if (action.payload.collabCount !== undefined) item.collabCount = action.payload.collabCount;
    },

    setThreadState: (state, action: PayloadAction<{ contentType: string; contentId: string; threadedByMe: boolean; threadCount: number }>) => {
      const k = key(action.payload.contentType, action.payload.contentId);
      const item = ensureItem(state, k);
      item.threadedByMe = action.payload.threadedByMe;
      item.threadCount = action.payload.threadCount;
    },

    // Optimistic thread toggle
    optimisticToggle: (state, action: PayloadAction<{ contentType: string; contentId: string; nextThreaded: boolean }>) => {
      const k = key(action.payload.contentType, action.payload.contentId);
      const item = ensureItem(state, k);
      const delta = action.payload.nextThreaded ? 1 : -1;
      item.threadedByMe = action.payload.nextThreaded;
      item.threadCount = Math.max(0, item.threadCount + delta);
    },

    // Reconcile with API response
    reconcile: (state, action: PayloadAction<{ contentType: string; contentId: string; threadedByMe?: boolean; threadCount?: number }>) => {
      const k = key(action.payload.contentType, action.payload.contentId);
      const item = ensureItem(state, k);

      if (typeof action.payload.threadedByMe === 'boolean') {
        item.threadedByMe = action.payload.threadedByMe;
      }

      if (typeof action.payload.threadCount === 'number') {
        item.threadCount = action.payload.threadCount;
      }
    },

    // WebSocket update for threads
    wsApplied: (state, action: PayloadAction<{ contentType: string; contentId: string; threadCount: number }>) => {
      const k = key(action.payload.contentType, action.payload.contentId);
      const item = ensureItem(state, k);
      item.threadCount = Number(action.payload.threadCount) || 0;
    },

    // Adjust (aggregate) a collection's thread count when a media thread is toggled.
    // This is a UI-level aggregation so backend remains unchanged.
    adjustAggregatedCollectionThreads: (state, action: PayloadAction<{ collectionId: string; delta: number }>) => {
      const k = key('COLLECTION', action.payload.collectionId);
      const item = ensureItem(state, k);
      item.threadCount = Math.max(0, item.threadCount + action.payload.delta);
    },

    // Update comment count
    updateCommentCount: (state, action: PayloadAction<{ contentType: string; contentId: string; commentCount: number }>) => {
      const k = key(action.payload.contentType, action.payload.contentId);
      const item = ensureItem(state, k);
      item.commentCount = action.payload.commentCount;
    },

    // Increment comment count (optimistic)
    incrementCommentCount: (state, action: PayloadAction<{ contentType: string; contentId: string }>) => {
      const k = key(action.payload.contentType, action.payload.contentId);
      const item = ensureItem(state, k);
      item.commentCount += 1;
    },

    // Decrement comment count (optimistic)
    decrementCommentCount: (state, action: PayloadAction<{ contentType: string; contentId: string }>) => {
      const k = key(action.payload.contentType, action.payload.contentId);
      const item = ensureItem(state, k);
      item.commentCount = Math.max(0, item.commentCount - 1);
    },

    // Update collab count
    updateCollabCount: (state, action: PayloadAction<{ contentType: string; contentId: string; collabCount: number }>) => {
      const k = key(action.payload.contentType, action.payload.contentId);
      const item = ensureItem(state, k);
      item.collabCount = action.payload.collabCount;
    },

    // Increment collab count (optimistic)
    incrementCollabCount: (state, action: PayloadAction<{ contentType: string; contentId: string }>) => {
      const k = key(action.payload.contentType, action.payload.contentId);
      const item = ensureItem(state, k);
      item.collabCount += 1;
    },

    // Decrement collab count (optimistic)
    decrementCollabCount: (state, action: PayloadAction<{ contentType: string; contentId: string }>) => {
      const k = key(action.payload.contentType, action.payload.contentId);
      const item = ensureItem(state, k);
      item.collabCount = Math.max(0, item.collabCount - 1);
    },
  },
});

export const {
  setEngagementState,
  setThreadState,
  optimisticToggle,
  reconcile,
  wsApplied,
  adjustAggregatedCollectionThreads,
  updateCommentCount,
  incrementCommentCount,
  decrementCommentCount,
  updateCollabCount,
  incrementCollabCount,
  decrementCollabCount,
} = engagementSlice.actions;

// Selectors
export const selectEngagementItem = (state: { engagement: EngagementState }, contentType: string, contentId: string): ItemState => {
  const k = key(contentType, contentId);
  return state.engagement.items[k] ?? { threadedByMe: false, threadCount: 0, commentCount: 0, collabCount: 0 };
};

export const selectThreadState = (state: { engagement: EngagementState }, contentType: string, contentId: string) => {
  const item = selectEngagementItem(state, contentType, contentId);
  return { threadedByMe: item.threadedByMe, threadCount: item.threadCount };
};

export const selectCommentCount = (state: { engagement: EngagementState }, contentType: string, contentId: string): number => {
  return selectEngagementItem(state, contentType, contentId).commentCount;
};

export const selectCollabCount = (state: { engagement: EngagementState }, contentType: string, contentId: string): number => {
  return selectEngagementItem(state, contentType, contentId).collabCount;
};

export default engagementSlice.reducer;

