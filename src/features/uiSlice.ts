import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

export type SidebarMode = 'RAIL' | 'DRAWER' | 'OVERLAY' | 'HIDDEN';

// Breakpoint constant - single source of truth
export const MOBILE_BREAKPOINT = 1024;

interface UiState {
    sidebarMode: SidebarMode;
    isSidebarOpen: boolean;
    viewportWidth: number; // Centralized viewport width
}

// Get initial viewport width safely (SSR-safe)
const getInitialViewportWidth = () => {
    if (typeof window !== 'undefined') {
        return window.innerWidth;
    }
    return 1920; // Default to desktop
};

const initialState: UiState = {
    sidebarMode: 'RAIL',
    isSidebarOpen: false,
    viewportWidth: getInitialViewportWidth(),
};

const uiSlice = createSlice({
    name: 'ui',
    initialState,
    reducers: {
        setSidebarMode: (state, action: PayloadAction<SidebarMode>) => {
            state.sidebarMode = action.payload;
            // Reset open state when mode changes to HIDDEN
            if (action.payload === 'HIDDEN') {
                state.isSidebarOpen = false;
            }
        },
        setViewportWidth: (state, action: PayloadAction<number>) => {
            state.viewportWidth = action.payload;
        },
        toggleSidebar: (state) => {
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

// Selector helpers
export const selectIsMobile = (state: { ui: UiState }) => state.ui.viewportWidth < MOBILE_BREAKPOINT;
export const selectViewportWidth = (state: { ui: UiState }) => state.ui.viewportWidth;

export const { setSidebarMode, setViewportWidth, toggleSidebar, closeSidebar, openSidebar } = uiSlice.actions;
export default uiSlice.reducer;

