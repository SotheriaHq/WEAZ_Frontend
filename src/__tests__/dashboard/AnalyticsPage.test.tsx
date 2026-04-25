import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AnalyticsPage from '../../pages/dashboard/AnalyticsPage';
import { brandApi } from '../../api/BrandApi';
import { Provider } from 'react-redux';
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import userReducer from '../../features/userSlice';

// Mock BrandApi
vi.mock('../../api/BrandApi', () => ({
  brandApi: {
    getDashboardAnalytics: vi.fn(),
  },
}));

// Mock Recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: () => <div data-testid="bar-chart">Bar Chart</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
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

const mockAnalyticsData = {
  salesChart: [
    { date: '2023-01-01', amount: 1000 },
    { date: '2023-01-02', amount: 2000 },
  ],
  currency: 'NGN',
};

describe('AnalyticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders analytics data after fetching', async () => {
    (brandApi.getDashboardAnalytics as any).mockResolvedValue(mockAnalyticsData);

    const store = createTestStore({
      user: {
        profile: mockUser,
        isAuthenticated: true,
      },
    });

    render(
      <Provider store={store}>
        <AnalyticsPage />
      </Provider>
    );

    // Initial loading
    // expect(screen.getByRole('status')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Revenue Over Time')).toBeInTheDocument();
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });

    expect(brandApi.getDashboardAnalytics).toHaveBeenCalledWith('user-123', '30d');
  });

  it('updates range when buttons are clicked', async () => {
    (brandApi.getDashboardAnalytics as any).mockResolvedValue(mockAnalyticsData);

    const store = createTestStore({
      user: {
        profile: mockUser,
        isAuthenticated: true,
      },
    });

    render(
      <Provider store={store}>
        <AnalyticsPage />
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Revenue Over Time')).toBeInTheDocument();
    });

    // Click "7 Days"
    fireEvent.click(screen.getByText('7 Days'));

    await waitFor(() => {
      expect(brandApi.getDashboardAnalytics).toHaveBeenCalledWith('user-123', '7d');
    });

    // Click "Year"
    fireEvent.click(screen.getByText('Year'));

    await waitFor(() => {
      expect(brandApi.getDashboardAnalytics).toHaveBeenCalledWith('user-123', 'ytd');
    });
  });
});
