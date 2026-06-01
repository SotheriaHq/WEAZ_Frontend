import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminModerationPage from './AdminModerationPage';

const { getQueue, getReviews, getReports, reviewItem, moderateReview, permissionState } =
  vi.hoisted(() => ({
    getQueue: vi.fn(),
    getReviews: vi.fn(),
    getReports: vi.fn(),
    reviewItem: vi.fn(),
    moderateReview: vi.fn(),
    permissionState: { canReview: true },
  }));

vi.mock('@/api/AdminApi', () => ({
  adminModerationApi: {
    getQueue,
    reviewItem,
  },
  adminReviewsApi: {
    getReviews,
    getReports,
    moderateReview,
  },
}));

vi.mock('@/components/admin/AdminBreadcrumb', () => ({
  default: () => <nav aria-label="Breadcrumb">Moderation</nav>,
}));

vi.mock('@/components/ui/ConfirmDialog', () => ({
  default: ({
    open,
    title,
    message,
    onConfirm,
    onCancel,
  }: {
    open: boolean;
    title?: string;
    message?: string;
    onConfirm: () => void | Promise<void>;
    onCancel: () => void;
  }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        <p>{message}</p>
        <button type="button" onClick={onConfirm}>
          Confirm
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    ) : null,
}));

vi.mock('@/hooks/useAdminPermissions', () => ({
  useAdminPermissions: () => ({
    hasPermission: (permission: string) =>
      permission === 'MODERATION_REVIEW' ? permissionState.canReview : true,
  }),
}));

vi.mock('react-redux', () => ({
  useSelector: (selector: (state: { notifications: { items: unknown[] } }) => unknown) =>
    selector({ notifications: { items: [] } }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('AdminModerationPage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    permissionState.canReview = true;
    getQueue.mockResolvedValue({
      data: {
        data: {
          freeformPoints: [
            {
              id: 'point-1',
              label: 'Sleeve Length',
              createdAt: '2026-05-18T10:00:00.000Z',
            },
          ],
          sizeCharts: [],
        },
      },
    });
    getReviews.mockResolvedValue({ data: { data: { items: [] } } });
    getReports.mockResolvedValue({ data: { data: { items: [] } } });
    reviewItem.mockResolvedValue({ data: { data: { status: 'APPROVED' } } });
    moderateReview.mockResolvedValue({ data: { data: { status: 'OK' } } });
  });

  it('sends lowercase queue moderation actions accepted by the backend DTO', async () => {
    render(<AdminModerationPage />);

    expect(await screen.findByText(/Sleeve Length/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Approve/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

    await waitFor(() =>
      expect(reviewItem).toHaveBeenCalledWith('point-1', { action: 'approve' }),
    );
  });

  it('hides queue moderation actions from permission-limited admins', async () => {
    permissionState.canReview = false;

    render(<AdminModerationPage />);

    expect(await screen.findByText(/Sleeve Length/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Approve/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Reject/i })).toBeNull();
  });
});
