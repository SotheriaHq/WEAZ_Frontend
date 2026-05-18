import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BrandReviewsDashboardPage from './BrandReviewsDashboardPage';

const { getBrandLifecycleDashboard, reportBrandLifecycleReview } = vi.hoisted(() => ({
  getBrandLifecycleDashboard: vi.fn(),
  reportBrandLifecycleReview: vi.fn(),
}));

vi.mock('@/api/ReviewApi', () => ({
  default: {
    getBrandLifecycleDashboard,
    reportBrandLifecycleReview,
  },
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

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const review = {
  id: 'review-1',
  reviewerId: 'buyer-1',
  brandId: 'brand-1',
  productId: 'product-1',
  collectionId: null,
  legacyCollectionId: null,
  designId: null,
  orderId: 'order-1',
  orderItemId: 'order-item-1',
  customOrderId: null,
  targetType: 'PRODUCT',
  rating: 5,
  satisfaction: 'HAPPY',
  reviewText: 'The stitching and delivery were excellent.',
  verifiedPurchase: true,
  status: 'APPROVED',
  editWindowExpiresAt: '2026-05-19T10:00:00.000Z',
  editedAt: null,
  deletedAt: null,
  createdAt: '2026-05-18T10:00:00.000Z',
  updatedAt: '2026-05-18T10:00:00.000Z',
  canEdit: false,
  canDelete: false,
  reviewer: {
    id: 'buyer-1',
    displayName: 'Buyer One',
  },
  target: {
    type: 'PRODUCT',
    id: 'product-1',
    name: 'Tailored Jacket',
  },
};

const dashboard = {
  items: [review],
  summary: {
    averageRating: 5,
    reviewCount: 1,
    ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 },
    satisfactionDistribution: { NONE: 0, ANGRY: 0, SAD: 0, OKAY: 0, HAPPY: 1, EXCITED: 0 },
    statusCounts: { APPROVED: 1, PENDING_MODERATION: 0, HIDDEN: 0, FLAGGED: 0, DELETED: 0 },
    targetTypeCounts: { PRODUCT: 1, COLLECTION: 0, DESIGN: 0, CUSTOM_ORDER: 0, BRAND: 0 },
    flaggedCount: 0,
    hiddenCount: 0,
    deletedCount: 0,
    pendingModerationCount: 0,
  },
  breakdown: {
    targets: [{ targetType: 'PRODUCT', targetId: 'product-1', name: 'Tailored Jacket', reviewCount: 1, averageRating: 5 }],
  },
  nextCursor: null,
};

describe('BrandReviewsDashboardPage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getBrandLifecycleDashboard.mockResolvedValue(dashboard);
    reportBrandLifecycleReview.mockResolvedValue({ ...review, status: 'FLAGGED' });
  });

  it('renders read-only brand review dashboard data without buyer delete controls', async () => {
    render(<BrandReviewsDashboardPage />);

    expect(await screen.findByText('Reviews Dashboard')).toBeTruthy();
    expect(screen.getAllByText('Tailored Jacket').length).toBeGreaterThan(0);
    expect(screen.getByText('The stitching and delivery were excellent.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /approve/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /hide/i })).toBeNull();
  });

  it('reports a review for admin moderation with a required reason', async () => {
    render(<BrandReviewsDashboardPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Report' }));
    fireEvent.change(screen.getByPlaceholderText('Optional context for admins'), {
      target: { value: 'This looks unrelated to the order.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Report review' }));

    await waitFor(() =>
      expect(reportBrandLifecycleReview).toHaveBeenCalledWith('review-1', {
        reason: 'OFF_TOPIC',
        details: 'This looks unrelated to the order.',
      }),
    );
  });
});
