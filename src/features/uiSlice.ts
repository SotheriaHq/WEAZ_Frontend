import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

export type SidebarMode = 'RAIL' | 'DRAWER' | 'OVERLAY' | 'HIDDEN';

interface UiState {
    sidebarMode: SidebarMode;
    isSidebarOpen: boolean;
}

const initialState: UiState = {
    sidebarMode: 'RAIL',
    isSidebarOpen: false, // For OVERLAY/DRAWER states
};

const uiSlice = createSlice({
    name: 'ui',
    initialState,
    reducers: {
        setSidebarMode: (state, action: PayloadAction<SidebarMode>) => {
            state.sidebarMode = action.payload;
            // Reset open state when mode changes, unless switching between Drawer/Rail
            if (action.payload === 'HIDDEN') {
                state.isSidebarOpen = false;
            }
        },
        toggleSidebar: (state) => {
            // Toggle open state. 
            // If it was RAIL or HIDDEN, opening it makes it OVERLAY (conceptually).
            // We don't need to change sidebarMode to 'DRAWER' or 'OVERLAY' explicitly if we just use isSidebarOpen to trigger the Overlay component.
            // However, to keep it clean:
            // If we are in RAIL mode, we stay in RAIL mode but set isSidebarOpen = true.
            // The Sidebar component will see isSidebarOpen=true and render the Overlay ON TOP of the Rail.
            state.isSidebarOpen = !state.isSidebarOpen;
        },
        closeSidebar: (state) => {
            state.isSidebarOpen = false;
        },
        openSidebar: (state) => {
            state.isSidebarOpen = true;
        }
    },
});

export const { setSidebarMode, toggleSidebar, closeSidebar, openSidebar } = uiSlice.actions;
export default uiSlice.reducer;
