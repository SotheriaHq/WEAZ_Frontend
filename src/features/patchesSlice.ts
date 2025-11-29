import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { brandApi } from '../api/BrandApi';
import type { RootState } from '../store';

interface Patch {
    id: string;
    partner: {
        id: string;
        username: string;
        brandFullName: string;
        profileImage: string | null;
    };
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'REVOKED';
    createdAt: string;
}

interface PatchesState {
    pending: Patch[];
    active: Patch[];
    history: Patch[];
    loading: boolean;
    error: string | null;
}

const initialState: PatchesState = {
    pending: [],
    active: [],
    history: [],
    loading: false,
    error: null,
};

export const fetchPatches = createAsyncThunk(
    'patches/fetchPatches',
    async ({ brandId, status }: { brandId: string; status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'REVOKED' }, { rejectWithValue }) => {
        try {
            const response = await brandApi.getBrandPatches(brandId, status);
            return { status, items: response.items };
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch patches');
        }
    }
);

export const respondToPatch = createAsyncThunk(
    'patches/respondToPatch',
    async ({ patchId, action }: { patchId: string; action: 'ACCEPTED' | 'REJECTED' }, { rejectWithValue }) => {
        try {
            await brandApi.respondToBrandPatch(patchId, action);
            return { patchId, action };
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || 'Failed to respond to patch');
        }
    }
);

export const cancelPatch = createAsyncThunk(
    'patches/cancelPatch',
    async (patchId: string, { rejectWithValue }) => {
        try {
            await brandApi.cancelBrandPatch(patchId);
            return patchId;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || 'Failed to cancel patch');
        }
    }
);

const patchesSlice = createSlice({
    name: 'patches',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            // Fetch
            .addCase(fetchPatches.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchPatches.fulfilled, (state, action) => {
                state.loading = false;
                const { status, items } = action.payload;
                if (status === 'PENDING') state.pending = items;
                else if (status === 'ACCEPTED') state.active = items;
                else state.history = items; // Simplified: grouping rejected/revoked into history
            })
            .addCase(fetchPatches.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Respond
            .addCase(respondToPatch.fulfilled, (state, action) => {
                const { patchId, action: responseAction } = action.payload;
                // Remove from pending
                state.pending = state.pending.filter((p) => p.id !== patchId);
                // If accepted, we might want to reload active, or optimistically add it if we had full patch data
                // For now, just removing from pending is enough to update UI
            })
            // Cancel
            .addCase(cancelPatch.fulfilled, (state, action) => {
                const patchId = action.payload;
                state.pending = state.pending.filter((p) => p.id !== patchId);
            });
    },
});

export const selectPatches = (state: RootState) => state.patches;
export default patchesSlice.reducer;
