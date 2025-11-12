import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

type Key = string; // `${contentType}:${contentId}`

interface ItemState {
  likedByMe: boolean;
  likeCount: number;
  commentCount: number;
  patchCount: number;
}

interface EngagementState { items: Record<Key, ItemState>; }

const initialState: EngagementState = { items: {} };

function key(t: string, id: string) { return `${t}:${id}`; }

function ensureItem(state: EngagementState, k: Key): ItemState {
  if (!state.items[k]) {
    state.items[k] = { likedByMe: false, likeCount: 0, commentCount: 0, patchCount: 0 };
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
      likedByMe?: boolean; 
      likeCount?: number;
      commentCount?: number;
      patchCount?: number;
    }>) => {
      const k = key(action.payload.contentType, action.payload.contentId);
      const item = ensureItem(state, k);
      if (action.payload.likedByMe !== undefined) item.likedByMe = action.payload.likedByMe;
      if (action.payload.likeCount !== undefined) item.likeCount = action.payload.likeCount;
      if (action.payload.commentCount !== undefined) item.commentCount = action.payload.commentCount;
      if (action.payload.patchCount !== undefined) item.patchCount = action.payload.patchCount;
    },

    // Legacy setLikeState for backward compatibility
    setLikeState: (state, action: PayloadAction<{ contentType: string; contentId: string; likedByMe: boolean; likeCount: number }>) => {
      const k = key(action.payload.contentType, action.payload.contentId);
      const item = ensureItem(state, k);
      item.likedByMe = action.payload.likedByMe;
      item.likeCount = action.payload.likeCount;
    },

    // Optimistic like toggle
    optimisticToggle: (state, action: PayloadAction<{ contentType: string; contentId: string; nextLiked: boolean }>) => {
      const k = key(action.payload.contentType, action.payload.contentId);
      const item = ensureItem(state, k);
      const delta = action.payload.nextLiked ? 1 : -1;
      item.likedByMe = action.payload.nextLiked;
      item.likeCount = Math.max(0, item.likeCount + delta);
    },

    // Reconcile with API response
    reconcile: (state, action: PayloadAction<{ contentType: string; contentId: string; likedByMe?: boolean; likeCount?: number }>) => {
      const k = key(action.payload.contentType, action.payload.contentId);
      const item = ensureItem(state, k);

      if (typeof action.payload.likedByMe === 'boolean') {
        item.likedByMe = action.payload.likedByMe;
      }

      if (typeof action.payload.likeCount === 'number') {
        item.likeCount = action.payload.likeCount;
      }
    },

    // WebSocket update for likes
    wsApplied: (state, action: PayloadAction<{ contentType: string; contentId: string; likeCount: number }>) => {
      const k = key(action.payload.contentType, action.payload.contentId);
      const item = ensureItem(state, k);
      item.likeCount = Number(action.payload.likeCount) || 0;
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

    // Update patch count
    updatePatchCount: (state, action: PayloadAction<{ contentType: string; contentId: string; patchCount: number }>) => {
      const k = key(action.payload.contentType, action.payload.contentId);
      const item = ensureItem(state, k);
      item.patchCount = action.payload.patchCount;
    },

    // Increment patch count (optimistic)
    incrementPatchCount: (state, action: PayloadAction<{ contentType: string; contentId: string }>) => {
      const k = key(action.payload.contentType, action.payload.contentId);
      const item = ensureItem(state, k);
      item.patchCount += 1;
    },

    // Decrement patch count (optimistic)
    decrementPatchCount: (state, action: PayloadAction<{ contentType: string; contentId: string }>) => {
      const k = key(action.payload.contentType, action.payload.contentId);
      const item = ensureItem(state, k);
      item.patchCount = Math.max(0, item.patchCount - 1);
    },
  },
});

export const { 
  setEngagementState,
  setLikeState, 
  optimisticToggle, 
  reconcile, 
  wsApplied,
  updateCommentCount,
  incrementCommentCount,
  decrementCommentCount,
  updatePatchCount,
  incrementPatchCount,
  decrementPatchCount,
} = engagementSlice.actions;

// Selectors
export const selectEngagementItem = (state: { engagement: EngagementState }, contentType: string, contentId: string): ItemState => {
  const k = key(contentType, contentId);
  return state.engagement.items[k] ?? { likedByMe: false, likeCount: 0, commentCount: 0, patchCount: 0 };
};

export const selectLikeState = (state: { engagement: EngagementState }, contentType: string, contentId: string) => {
  const item = selectEngagementItem(state, contentType, contentId);
  return { likedByMe: item.likedByMe, likeCount: item.likeCount };
};

export const selectCommentCount = (state: { engagement: EngagementState }, contentType: string, contentId: string): number => {
  return selectEngagementItem(state, contentType, contentId).commentCount;
};

export const selectPatchCount = (state: { engagement: EngagementState }, contentType: string, contentId: string): number => {
  return selectEngagementItem(state, contentType, contentId).patchCount;
};

export default engagementSlice.reducer;

