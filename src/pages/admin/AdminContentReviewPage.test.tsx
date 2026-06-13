import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminContentReviewPage from './AdminContentReviewPage';

const {
  getReasonCodes,
  listSubmissions,
  getSubmission,
  approveSubmission,
  rejectSubmission,
  requestChanges,
  listReports,
  resolveReport,
} = vi.hoisted(() => ({
  getReasonCodes: vi.fn(),
  listSubmissions: vi.fn(),
  getSubmission: vi.fn(),
  approveSubmission: vi.fn(),
  rejectSubmission: vi.fn(),
  requestChanges: vi.fn(),
  listReports: vi.fn(),
  resolveReport: vi.fn(),
}));

vi.mock('@/api/AdminApi', () => ({
  adminContentReviewApi: {
    getReasonCodes,
    listSubmissions,
    getSubmission,
    approveSubmission,
    rejectSubmission,
    requestChanges,
    listReports,
    resolveReport,
  },
}));

vi.mock('@/components/admin/AdminBreadcrumb', () => ({
  default: () => <nav aria-label="Breadcrumb">Content Review</nav>,
}));

vi.mock('@/components/ui/Modal', () => ({
  default: ({
    open,
    title,
    children,
  }: {
    open: boolean;
    title?: string;
    children: React.ReactNode;
  }) => (open ? <div role="dialog" aria-label={title}>{children}</div> : null),
}));

vi.mock('@/components/ui/ConfirmDialog', () => ({
  default: ({
    open,
    title,
    onConfirm,
  }: {
    open: boolean;
    title?: string;
    onConfirm: () => void | Promise<void>;
  }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        <button type="button" onClick={onConfirm}>Approve</button>
      </div>
    ) : null,
}));

vi.mock('@/components/forms/UniversalSelect', () => ({
  default: ({
    label,
    value,
    onChange,
    options,
    placeholder,
    error,
  }: {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
    placeholder?: string;
    error?: string;
  }) => (
    <label>
      {label ?? placeholder ?? 'Select'}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select reason</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <span>{error}</span>}
    </label>
  ),
}));

vi.mock('@/hooks/useAdminPermissions', () => ({
  useAdminPermissions: () => ({ hasPermission: () => true }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const submission = {
  id: 'submission-1',
  entityType: 'PRODUCT',
  status: 'IN_REVIEW',
  previousStatus: 'DRAFT',
  targetStatus: 'PUBLISHED',
  reasonCode: null,
  reasonLabel: null,
  reasonNote: null,
  submittedAt: '2026-06-01T10:00:00.000Z',
  reviewedAt: null,
  target: {
    id: 'product-1',
    type: 'PRODUCT',
    reportTargetType: 'PRODUCT',
    title: 'Adire Jacket',
    description: 'Hand-dyed jacket',
    brandId: 'brand-1',
    status: 'IN_REVIEW',
  },
  brand: {
    id: 'brand-1',
    name: 'Ayo Studio',
    trustTier: 'NEW',
    reviewMode: 'PRE_REVIEW_REQUIRED',
  },
  submittedBy: { id: 'owner-1', username: 'brandowner' },
  reviewedBy: null,
  media: [
    {
      id: 'media-front',
      fileId: 'file-front',
      mediaType: 'POST_IMAGE',
      mimeType: 'image/jpeg',
      slot: 'FRONT',
      slotLabel: 'Front',
      mediaPurpose: 'REQUIRED_VIEW',
      reviewStatus: 'PENDING',
      orderIndex: 0,
      canPreview: true,
      previewUrl: 'https://signed.example/front.jpg?token=ok',
    },
  ],
  requiredSlotChecklist: [
    { slot: 'FRONT', label: 'Front', present: true, mediaId: 'media-front', reviewStatus: 'PENDING' },
    { slot: 'BACK', label: 'Back', present: false, mediaId: null, reviewStatus: null },
  ],
  slotCompleteness: { required: 2, present: 1, missing: ['BACK'] },
  reviewHistory: [],
  reports: [],
};

describe('AdminContentReviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getReasonCodes.mockResolvedValue({
      data: { data: [{ code: 'MISSING_REQUIRED_VIEW', label: 'Missing required view' }] },
    });
    listReports.mockResolvedValue({
      data: { data: { items: [], summary: { open: 0, reviewed: 0, resolved: 0, dismissed: 0 } } },
    });
    approveSubmission.mockResolvedValue({ data: { data: submission } });
    rejectSubmission.mockResolvedValue({ data: { data: { ...submission, status: 'REJECTED' } } });
    requestChanges.mockResolvedValue({ data: { data: { ...submission, status: 'CHANGES_REQUESTED' } } });
    resolveReport.mockResolvedValue({ data: { data: {} } });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the empty queue state', async () => {
    listSubmissions.mockResolvedValue({
      data: {
        data: {
          items: [],
          summary: { pending: 0, changesRequested: 0, rejected: 0, approvedPublished: 0 },
        },
      },
    });

    render(<AdminContentReviewPage />);

    expect(await screen.findByText('No content waiting for review.')).toBeTruthy();
    expect(screen.getByText('Submissions that need approval will appear here.')).toBeTruthy();
  });

  it('renders media slots and blocks request changes without a reason', async () => {
    listSubmissions.mockResolvedValue({
      data: {
        data: {
          items: [submission],
          summary: { pending: 1, changesRequested: 0, rejected: 0, approvedPublished: 0 },
        },
      },
    });
    getSubmission.mockResolvedValue({ data: { data: submission } });

    render(<AdminContentReviewPage />);

    expect(await screen.findByText('Adire Jacket')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Review/i }));
    const mediaImage = await screen.findByAltText('Front media');
    expect(mediaImage.getAttribute('src')).toBe('https://signed.example/front.jpg?token=ok');
    expect(screen.queryByText('Required Slot Checklist')).toBeNull();
    expect(screen.getByText('Missing Required Views')).toBeTruthy();
    expect(screen.getAllByText('Front').length).toBeGreaterThan(0);
    expect(screen.getByText('Back')).toBeTruthy();
    expect(screen.getByText(/Submitted:/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Request Changes/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    expect(await screen.findByText('Select a predefined reason before continuing.')).toBeTruthy();
    expect(requestChanges).not.toHaveBeenCalled();
  });

  it('sends selected reasons to backend review actions', async () => {
    listSubmissions.mockResolvedValue({
      data: {
        data: {
          items: [submission],
          summary: { pending: 1, changesRequested: 0, rejected: 0, approvedPublished: 0 },
        },
      },
    });
    getSubmission.mockResolvedValue({ data: { data: submission } });

    render(<AdminContentReviewPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Review/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Reject/i }));
    fireEvent.change(screen.getByLabelText(/Reason/i), {
      target: { value: 'MISSING_REQUIRED_VIEW' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    await waitFor(() =>
      expect(rejectSubmission).toHaveBeenCalledWith('submission-1', {
        reasonCode: 'MISSING_REQUIRED_VIEW',
        reasonNote: undefined,
      }),
    );
  });
});
