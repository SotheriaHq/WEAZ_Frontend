import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import AdminReviewsPage from './AdminReviewsPage';

const { getLifecycleReviews, getLifecycleReview, approveLifecycleReview, hideLifecycleReview, flagLifecycleReview } = vi.hoisted(() => ({
  getLifecycleReviews: vi.fn(),
  getLifecycleReview: vi.fn(),
  approveLifecycleReview: vi.fn(),
  hideLifecycleReview: vi.fn(),
  flagLifecycleReview: vi.fn(),
}));

vi.mock('@/api/AdminApi', () => ({
  adminReviewsApi: {
    getLifecycleReviews,
    getLifecycleReview,
    approveLifecycleReview,
    hideLifecycleReview,
    flagLifecycleReview,
  },
}));

vi.mock('@/components/admin/AdminBreadcrumb', () => ({
  default: () => <nav aria-label="Breadcrumb">Reviews</nav>,
}));

vi.mock('@/components/forms/UniversalSelect', () => ({
  default: ({
    value,
    onChange,
    options,
    placeholder,
  }: {
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
    placeholder?: string;
  }) => (
    <select aria-label={placeholder} value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock('@/hooks/useAdminPermissions', () => ({
  useAdminPermissions: () => ({
    hasPermission: () => true,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const lifecycleReview = {
  id: 'review-1',
  reviewerId: 'buyer-1',
  brandId: 'brand-1',
  productId: 'product-1',
  collectionId: null,
  legacyCollectionId: null,
  designId: null,
  orderId: 'order-1',
  orderItemId: 'item-1',
  customOrderId: null,
  targetType: 'PRODUCT',
  rating: 5,
  satisfaction: 'HAPPY',
  reviewText: 'Excellent fit and delivery.',
  verifiedPurchase: true,
  status: 'FLAGGED',
  editWindowExpiresAt: '2026-05-18T12:00:00.000Z',
  editedAt: null,
  deletedAt: null,
  createdAt: '2026-05-18T10:00:00.000Z',
  updatedAt: '2026-05-18T10:00:00.000Z',
  reviewer: {
    id: 'buyer-1',
    email: 'buyer@example.test',
    username: 'buyer',
    displayName: 'Buyer One',
  },
  brand: {
    id: 'brand-1',
    name: 'Review Brand',
  },
  target: {
    type: 'PRODUCT',
    id: 'product-1',
    name: 'Reviewed Product',
  },
};

describe('AdminReviewsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLifecycleReviews.mockResolvedValue({
      data: {
        data: {
          items: [lifecycleReview],
          nextCursor: null,
        },
      },
    });
    getLifecycleReview.mockResolvedValue({ data: { data: lifecycleReview } });
    approveLifecycleReview.mockResolvedValue({ data: { data: { ...lifecycleReview, status: 'APPROVED' } } });
    hideLifecycleReview.mockResolvedValue({ data: { data: { ...lifecycleReview, status: 'HIDDEN' } } });
    flagLifecycleReview.mockResolvedValue({ data: { data: lifecycleReview } });
  });

  it('renders lifecycle reviews with moderation actions and no hard delete action', async () => {
    render(<AdminReviewsPage />);

    expect(await screen.findByText('Buyer One')).toBeTruthy();
    expect(screen.getByText('Reviewed Product')).toBeTruthy();
    expect(screen.getByText('FLAGGED')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
  });

  it('approves a lifecycle review through the admin moderation endpoint', async () => {
    render(<AdminReviewsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(approveLifecycleReview).toHaveBeenCalledWith('review-1'));
  });
});
