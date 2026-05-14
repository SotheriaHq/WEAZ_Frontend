import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuthUserDto } from '../../types/auth';
import OrderManagement from '../../pages/dashboard/OrderManagement';
import { brandApi } from '../../api/BrandApi';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import userReducer, { type UserState } from '../../features/userSlice';
import { BrowserRouter } from 'react-router-dom';

// Mock BrandApi
vi.mock('../../api/BrandApi', () => ({
  brandApi: {
    getOrders: vi.fn(),
    updateOrderStatus: vi.fn(),
  },
}));

// Mock OrderDetailsModal
vi.mock('../../components/dashboard/OrderDetailsModal', () => ({
  default: () => <div data-testid="order-details-modal">Order Details Modal</div>,
}));

const createTestStore = (initialState: { user: UserState }) => {
  return configureStore({
    reducer: {
      user: userReducer,
    },
    preloadedState: initialState,
  });
};

const mockUser: AuthUserDto = {
  id: 'user-123',
  storeId: null,
  email: 'brand@example.com',
  username: 'brand_demo',
  firstName: 'Demo',
  lastName: 'Brand',
  role: 'User',
  type: 'BRAND',
  themePreference: 'system',
  isActive: 'Active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  isEmailVerified: true,
  brandTags: [],
  phoneNumber: null,
  address: null,
  brandFullName: null,
  brandDescription: null,
  brandCountry: null,
  brandState: null,
  brandCity: null,
  brandBusinessType: null,
  socialInstagram: null,
  socialFacebook: null,
  socialTwitter: null,
  socialWebsite: null,
  cacNumber: null,
  tin: null,
  ceoNin: null,
  ceoFirstName: null,
  ceoLastName: null,
  companyLocation: null,
  profileImage: null,
  profileImageId: null,
  profileImageFile: null,
  bannerImage: null,
  bannerImageId: null,
  bannerImageFile: null,
};

const mockOrders = {
  items: [
    {
      id: 'order-1',
      customerName: 'Customer 1',
      createdAt: new Date().toISOString(),
      totalAmount: 5000,
      currency: 'NGN',
      status: 'PENDING',
      paymentStatus: 'PAID',
    },
    {
      id: 'order-2',
      customerName: 'Customer 2',
      createdAt: new Date().toISOString(),
      totalAmount: 10000,
      currency: 'NGN',
      status: 'SHIPPED',
      paymentStatus: 'PAID',
    },
  ],
  meta: {
    totalPages: 2,
  },
};

describe('OrderManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders orders after fetching', async () => {
    (brandApi.getOrders as any).mockResolvedValue(mockOrders);

    const store = createTestStore({
      user: {
        profile: mockUser,
        isAuthenticated: true,
      },
    });

    render(
      <Provider store={store}>
        <BrowserRouter>
          <OrderManagement />
        </BrowserRouter>
      </Provider>
    );

    // Initial loading state
    // expect(screen.getByRole('status')).toBeInTheDocument(); // If spinner has role status

    // Wait for orders to load
    await waitFor(() => {
      expect(screen.getByText('Customer 1')).toBeInTheDocument();
      expect(screen.getByText('Customer 2')).toBeInTheDocument();
    });

    expect(brandApi.getOrders).toHaveBeenCalledWith('user-123', expect.objectContaining({
      page: 1,
      limit: 10,
    }));
  });

  it('handles search and filter', async () => {
    (brandApi.getOrders as any).mockResolvedValue(mockOrders);

    const store = createTestStore({
      user: {
        profile: mockUser,
        isAuthenticated: true,
      },
    });

    render(
      <Provider store={store}>
        <BrowserRouter>
          <OrderManagement />
        </BrowserRouter>
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Customer 1')).toBeInTheDocument();
    });

    // Filter by status
    const statusSelect = screen.getByRole('combobox');
    fireEvent.change(statusSelect, { target: { value: 'PENDING' } });

    await waitFor(() => {
      expect(brandApi.getOrders).toHaveBeenCalledWith('user-123', expect.objectContaining({
        status: 'PENDING',
      }));
    });

    // Search
    const searchInput = screen.getByPlaceholderText(/Search by order ID/i);
    fireEvent.change(searchInput, { target: { value: 'Cust' } });

    // Wait for debounce
    await waitFor(() => {
      expect(brandApi.getOrders).toHaveBeenCalledWith('user-123', expect.objectContaining({
        q: 'Cust',
      }));
    }, { timeout: 1000 });
  });
});
