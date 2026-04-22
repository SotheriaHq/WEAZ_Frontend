import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
    brandApi,
    type BrandPatchHistoryAction,
    type BrandPatchHistoryItem,
    type BrandPatchItem,
    type BrandPatchStatus,
} from '../api/BrandApi';
import type { RootState } from '../store';

type PatchesTab = 'pending' | 'active' | 'history';

interface PatchesState {
    pending: BrandPatchItem[];
    active: BrandPatchItem[];
    history: BrandPatchHistoryItem[];
    loading: boolean;
    loadingTab: PatchesTab | null;
    loaded: Record<PatchesTab, boolean>;
    error: string | null;
}

const initialState: PatchesState = {
    pending: [],
    active: [],
    history: [],
    loading: false,
    loadingTab: null,
    loaded: {
        pending: false,
        active: false,
        history: false,
    },
    error: null,
};

const resolvePatchStatusFromAction = (
    action: BrandPatchHistoryAction,
): BrandPatchStatus => {
    if (action === 'REQUESTED') return 'PENDING';
    if (action === 'ACCEPTED') return 'ACCEPTED';
    return 'REJECTED';
};

const createLocalHistoryEntry = ({
    patch,
    action,
    createdAt,
}: {
    patch: BrandPatchItem;
    action: BrandPatchHistoryAction;
    createdAt: string;
}): BrandPatchHistoryItem => ({
    id: `${patch.id}:${action}:${createdAt}`,
    patchId: patch.id,
    partner: patch.partner,
    action,
    status: resolvePatchStatusFromAction(action),
    isOutgoing: patch.isOutgoing,
    actorId: null,
    createdAt,
});

export const fetchPatches = createAsyncThunk(
    'patches/fetchPatches',
    async (
        {
            brandId,
            status,
        }: { brandId: string; status: 'PENDING' | 'ACCEPTED' },
        { rejectWithValue },
    ) => {
        try {
            const response = await brandApi.getBrandPatches(brandId, status);
            return { status, items: response.items };
        } catch (error: any) {
            return rejectWithValue(
                error?.response?.data?.message || 'Failed to fetch patches',
            );
        }
    },
);

export const fetchPatchHistory = createAsyncThunk(
    'patches/fetchPatchHistory',
    async ({ brandId }: { brandId: string }, { rejectWithValue }) => {
        try {
            const response = await brandApi.getBrandPatchHistory(brandId);
            return response.items;
        } catch (error: any) {
            return rejectWithValue(
                error?.response?.data?.message || 'Failed to fetch patch history',
            );
        }
    },
);

export const respondToPatch = createAsyncThunk(
    'patches/respondToPatch',
    async (
        { patchId, action }: { patchId: string; action: 'ACCEPTED' | 'REJECTED' },
        { rejectWithValue },
    ) => {
        try {
            await brandApi.respondToBrandPatch(patchId, action);
            return {
                patchId,
                action,
                actedAt: new Date().toISOString(),
            };
        } catch (error: any) {
            return rejectWithValue(
                error?.response?.data?.message || 'Failed to respond to patch',
            );
        }
    },
);

export const cancelPatch = createAsyncThunk(
    'patches/cancelPatch',
    async (patchId: string, { rejectWithValue }) => {
        try {
            const response = await brandApi.cancelBrandPatch(patchId);
            return {
                patchId,
                status: response.status,
                actedAt: new Date().toISOString(),
            };
        } catch (error: any) {
            return rejectWithValue(
                error?.response?.data?.message || 'Failed to cancel patch',
            );
        }
    },
);

const patchesSlice = createSlice({
    name: 'patches',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchPatches.pending, (state, action) => {
                state.loading = true;
                state.error = null;
                state.loadingTab =
                    action.meta.arg.status === 'PENDING' ? 'pending' : 'active';
            })
            .addCase(fetchPatches.fulfilled, (state, action) => {
                state.loading = false;
                state.loadingTab = null;
                const { status, items } = action.payload;
                if (status === 'PENDING') {
                    state.pending = items;
                    state.loaded.pending = true;
                    return;
                }
                state.active = items;
                state.loaded.active = true;
            })
            .addCase(fetchPatches.rejected, (state, action) => {
                state.loading = false;
                state.loadingTab = null;
                state.error = action.payload as string;
            })
            .addCase(fetchPatchHistory.pending, (state) => {
                state.loading = true;
                state.error = null;
                state.loadingTab = 'history';
            })
            .addCase(fetchPatchHistory.fulfilled, (state, action) => {
                state.loading = false;
                state.loadingTab = null;
                state.history = action.payload;
                state.loaded.history = true;
            })
            .addCase(fetchPatchHistory.rejected, (state, action) => {
                state.loading = false;
                state.loadingTab = null;
                state.error = action.payload as string;
            })
            .addCase(respondToPatch.fulfilled, (state, action) => {
                const { patchId, action: decision, actedAt } = action.payload;
                const pendingPatch = state.pending.find((patch) => patch.id === patchId);
                state.pending = state.pending.filter((patch) => patch.id !== patchId);

                if (!pendingPatch) {
                    return;
                }

                if (decision === 'ACCEPTED') {
                    state.active = [
                        {
                            ...pendingPatch,
                            status: 'ACCEPTED',
                            updatedAt: actedAt,
                        },
                        ...state.active.filter((patch) => patch.id !== patchId),
                    ];
                } else {
                    state.active = state.active.filter((patch) => patch.id !== patchId);
                }

                if (!state.loaded.history) {
                    return;
                }

                const historyAction: BrandPatchHistoryAction =
                    decision === 'ACCEPTED' ? 'ACCEPTED' : 'REJECTED';

                state.history = [
                    createLocalHistoryEntry({
                        patch: pendingPatch,
                        action: historyAction,
                        createdAt: actedAt,
                    }),
                    ...state.history.filter((entry) => entry.patchId !== patchId),
                ];
            })
            .addCase(respondToPatch.rejected, (state, action) => {
                state.error = action.payload as string;
            })
            .addCase(cancelPatch.fulfilled, (state, action) => {
                const { patchId, status, actedAt } = action.payload;
                const pendingPatch = state.pending.find((patch) => patch.id === patchId);
                const activePatch = state.active.find((patch) => patch.id === patchId);
                const changedPatch = pendingPatch ?? activePatch ?? null;

                state.pending = state.pending.filter((patch) => patch.id !== patchId);
                state.active = state.active.filter((patch) => patch.id !== patchId);

                if (!changedPatch || !state.loaded.history) {
                    return;
                }

                const historyAction: BrandPatchHistoryAction =
                    status === 'CANCELLED' ? 'CANCELLED' : 'REMOVED';

                state.history = [
                    createLocalHistoryEntry({
                        patch: changedPatch,
                        action: historyAction,
                        createdAt: actedAt,
                    }),
                    ...state.history.filter((entry) => entry.patchId !== patchId),
                ];
            })
            .addCase(cancelPatch.rejected, (state, action) => {
                state.error = action.payload as string;
            });
    },
});

export const selectPatches = (state: RootState) => state.patches;
export default patchesSlice.reducer;
