import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

type Key = string; // `${contentType}:${contentId}`

interface ItemState { likedByMe: boolean; likeCount: number; }
interface EngagementState { likes: Record<Key, ItemState>; }

const initialState: EngagementState = { likes: {} };

function key(t: string, id: string) { return `${t}:${id}`; }

export const engagementSlice = createSlice({
  name: 'engagement',
  initialState,
  reducers: {
    setLikeState: (state, action: PayloadAction<{ contentType: string; contentId: string; likedByMe: boolean; likeCount: number }>) => {
      const k = key(action.payload.contentType, action.payload.contentId);
      state.likes[k] = { likedByMe: action.payload.likedByMe, likeCount: action.payload.likeCount };
    },
    optimisticToggle: (state, action: PayloadAction<{ contentType: string; contentId: string; nextLiked: boolean }>) => {
      const k = key(action.payload.contentType, action.payload.contentId);
      const item = state.likes[k] ?? { likedByMe: false, likeCount: 0 };
      const delta = action.payload.nextLiked ? 1 : -1;
      state.likes[k] = { likedByMe: action.payload.nextLiked, likeCount: Math.max(0, item.likeCount + delta) };
    },
    reconcile: (state, action: PayloadAction<{ contentType: string; contentId: string; likedByMe?: boolean; likeCount: number }>) => {
      const k = key(action.payload.contentType, action.payload.contentId);
      const prev = state.likes[k] ?? { likedByMe: false, likeCount: 0 };
      state.likes[k] = { likedByMe: action.payload.likedByMe ?? prev.likedByMe, likeCount: action.payload.likeCount };
    },
    wsApplied: (state, action: PayloadAction<{ contentType: string; contentId: string; likeCount: number }>) => {
      const k = key(action.payload.contentType, action.payload.contentId);
      const prev = state.likes[k] ?? { likedByMe: false, likeCount: 0 };
      state.likes[k] = { likedByMe: prev.likedByMe, likeCount: action.payload.likeCount };
    },
  },
});

export const { setLikeState, optimisticToggle, reconcile, wsApplied } = engagementSlice.actions;
export default engagementSlice.reducer;

