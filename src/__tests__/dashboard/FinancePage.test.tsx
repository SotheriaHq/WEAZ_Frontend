import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FinancePage from '../../pages/dashboard/FinancePage';
import { brandApi } from '../../api/BrandApi';
import { Provider } from 'react-redux';
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import userReducer from '../../features/userSlice';
import { toast } from 'react-toastify';

// Mock BrandApi
vi.mock('../../api/BrandApi', () => ({
  brandApi: {
    getDashboardOverview: vi.fn(),
    getPayouts: vi.fn(),
    requestPayout: vi.fn(),
  },
}));

// Mock Toast
vi.mock('react-toastify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const rootReducer = combineReducers({
  user: userReducer,
});

const createTestStore = (initialState: any) => {
  return configureStore({
    reducer: rootReducer,
    preloadedState: initialState,
  });
};

const mockUser = {
  id: 'user-123',
  email: 'brand@example.com',
  role: 'User',
  type: 'BRAND',
};

const mockOverview = {
  kpis: {
    totalSales: 20000,
  },
};

const mockPayouts = [
  {
    id: 'payout-1',
    amount: 5000,
    status: 'COMPLETED',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'payout-2',
    amount: 5000,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  },
];

describe('FinancePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders balance and payout history', async () => {
    (brandApi.getDashboardOverview as any).mockResolvedValue(mockOverview);
    (brandApi.getPayouts as any).mockResolvedValue(mockPayouts);

    const store = createTestStore({
      user: {
        profile: mockUser,
        isAuthenticated: true,
      },
    });

    render(
      <Provider store={store}>
        <FinancePage />
      </Provider>
    );

    await waitFor(() => {
      // Balance = Total Sales (20000) - Completed Payouts (5000) = 15000
      expect(screen.getByText('₦15,000.00')).toBeInTheDocument();
      expect(screen.getByText('Payout History')).toBeInTheDocument();
      expect(screen.getByText('COMPLETED')).toBeInTheDocument();
      expect(screen.getByText('PENDING')).toBeInTheDocument();
    });
  });

  it('handles payout request success', async () => {
    (brandApi.getDashboardOverview as any).mockResolvedValue(mockOverview);
    (brandApi.getPayouts as any).mockResolvedValue(mockPayouts);
    (brandApi.requestPayout as any).mockResolvedValue({});

    const store = createTestStore({
      user: {
        profile: mockUser,
        isAuthenticated: true,
      },
    });

    render(
      <Provider store={store}>
        <FinancePage />
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Request Payout')).toBeEnabled();
    });

    fireEvent.click(screen.getByText('Request Payout'));

    await waitFor(() => {
      expect(brandApi.requestPayout).toHaveBeenCalledWith('user-123', 15000);
      expect(toast.success).toHaveBeenCalledWith('Payout requested successfully');
    });
  });

  it('validates minimum payout amount', async () => {
    // Low balance scenario
    (brandApi.getDashboardOverview as any).mockResolvedValue({ kpis: { totalSales: 4000 } });
    (brandApi.getPayouts as any).mockResolvedValue([]);

    const store = createTestStore({
      user: {
        profile: mockUser,
        isAuthenticated: true,
      },
    });

    render(
      <Provider store={store}>
        <FinancePage />
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Request Payout')).toBeDisabled();
    });
    
    // Even if we force click (if not disabled in DOM but logic check), or check logic
    // The button is disabled in UI code: disabled={requesting || availableBalance < 5000}
    expect(screen.getByText('Request Payout')).toBeDisabled();
  });
});
