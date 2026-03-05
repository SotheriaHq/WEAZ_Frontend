import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AdminState {
  permissions: string[];
  dashboardLoaded: boolean;
}

const initialState: AdminState = {
  permissions: [],
  dashboardLoaded: false,
};

const adminSlice = createSlice({
  name: 'admin',
  initialState,
  reducers: {
    setAdminPermissions(state, action: PayloadAction<string[]>) {
      state.permissions = action.payload;
    },
    setDashboardLoaded(state, action: PayloadAction<boolean>) {
      state.dashboardLoaded = action.payload;
    },
    resetAdminState() {
      return initialState;
    },
  },
});

export const { setAdminPermissions, setDashboardLoaded, resetAdminState } = adminSlice.actions;
export default adminSlice.reducer;
