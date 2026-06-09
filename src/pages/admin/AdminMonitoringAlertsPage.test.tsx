import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminMonitoringPage from './AdminMonitoringPage';

const {
  list,
  summary,
  getById,
  acknowledge,
  resolve,
  ignore,
  permissionState,
} = vi.hoisted(() => ({
  list: vi.fn(),
  summary: vi.fn(),
  getById: vi.fn(),
  acknowledge: vi.fn(),
  resolve: vi.fn(),
  ignore: vi.fn(),
  permissionState: {
    canRead: true,
    canManage: true,
  },
}));

vi.mock('@/api/AdminApi', () => ({
  adminAlertsApi: {
    list,
    summary,
    getById,
    acknowledge,
    resolve,
    ignore,
  },
}));

vi.mock('@/hooks/useAdminPermissions', () => ({
  useAdminPermissions: () => ({
    hasPermission: (permission: string) => {
      if (permission === 'ALERTS_READ') return permissionState.canRead;
      if (permission === 'ALERTS_MANAGE') return permissionState.canManage;
      return true;
    },
  }),
}));

vi.mock('@/components/admin/AdminBreadcrumb', () => ({
  default: () => <nav aria-label="Breadcrumb">Monitoring</nav>,
}));

vi.mock('@/components/forms/UniversalSelect', () => ({
  default: ({
    label,
    value,
    onChange,
    options,
  }: {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
  }) => (
    <label>
      {label}
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  ),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const alert = {
  id: 'alert-1',
  category: 'WEBHOOK',
  severity: 'CRITICAL',
  event: 'PAYMENT_WEBHOOK_AMOUNT_CURRENCY_MISMATCH',
  title: 'Payment mismatch',
  message: 'Payment amount mismatch detected',
  status: 'OPEN',
  actorId: null,
  userId: null,
  entityType: 'PaymentAttempt',
  entityId: 'attempt-1',
  correlationId: 'corr-1',
  metadata: {
    paystackSecret: 'sk_live_sensitive',
    webhookSignature: 'raw-signature',
    safeCount: 1,
  },
  dedupeKey: 'dedupe-1',
  occurrenceCount: 1,
  firstSeenAt: '2026-05-31T10:00:00.000Z',
  lastSeenAt: '2026-05-31T10:05:00.000Z',
  createdAt: '2026-05-31T10:00:00.000Z',
  acknowledgedAt: null,
  acknowledgedBy: null,
  resolvedAt: null,
  resolvedBy: null,
  ignoredAt: null,
  ignoredBy: null,
  notificationQueuedAt: '2026-05-31T10:06:00.000Z',
  emailQueuedAt: '2026-05-31T10:06:00.000Z',
};

describe('AdminMonitoringPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissionState.canRead = true;
    permissionState.canManage = true;
    summary.mockResolvedValue({
      data: {
        data: {
          open: 1,
          acknowledged: 0,
          resolved: 0,
          ignored: 0,
          critical: 1,
          paymentWebhook: 1,
          ranking: 0,
          uploadSecurity: 0,
        },
      },
    });
    list.mockResolvedValue({
      data: {
        data: {
          items: [alert],
          nextCursor: null,
        },
      },
    });
    getById.mockResolvedValue({ data: { data: alert } });
    acknowledge.mockResolvedValue({
      data: { data: { ...alert, status: 'ACKNOWLEDGED' } },
    });
    resolve.mockResolvedValue({ data: { data: { ...alert, status: 'RESOLVED' } } });
    ignore.mockResolvedValue({ data: { data: { ...alert, status: 'IGNORED' } } });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders summary, list, and redacted alert detail', async () => {
    render(<AdminMonitoringPage />);

    expect(await screen.findByText('Operational Alerts')).toBeTruthy();
    expect(screen.getAllByText('Redacted metadata').length).toBeGreaterThan(0);
    expect(screen.getByText(/Data loads from \/admin\/alerts\/summary/)).toBeTruthy();
    expect(await screen.findByText('Payment mismatch')).toBeTruthy();

    fireEvent.click(screen.getByText('Payment mismatch'));

    await waitFor(() => expect(getById).toHaveBeenCalledWith('alert-1'));
    expect(screen.getAllByText('Redacted metadata').length).toBeGreaterThan(0);
    expect(screen.queryByText('sk_live_sensitive')).toBeNull();
    expect(screen.queryByText('raw-signature')).toBeNull();
    expect(screen.getAllByText('[REDACTED]').length).toBeGreaterThan(0);
  });

  it('allows permitted admins to acknowledge alerts', async () => {
    render(<AdminMonitoringPage />);

    fireEvent.click(await screen.findByText('Payment mismatch'));
    fireEvent.click(await screen.findByRole('button', { name: 'Acknowledge' }));

    await waitFor(() => expect(acknowledge).toHaveBeenCalledWith('alert-1'));
  });

  it('hides lifecycle actions without manage permission', async () => {
    permissionState.canManage = false;

    render(<AdminMonitoringPage />);

    fireEvent.click(await screen.findByText('Payment mismatch'));

    expect(screen.queryByRole('button', { name: 'Acknowledge' })).toBeNull();
    expect(
      screen.getByText('Alert lifecycle actions require the alerts.manage permission.'),
    ).toBeTruthy();
  });

  it('shows a safe 403 state without read permission', () => {
    permissionState.canRead = false;

    render(<AdminMonitoringPage />);

    expect(
      screen.getByText('You do not have permission to view operational alerts.'),
    ).toBeTruthy();
    expect(list).not.toHaveBeenCalled();
  });

  it('passes filter changes to the alert list API', async () => {
    render(<AdminMonitoringPage />);

    await screen.findByText('Payment mismatch');
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: 'PAYMENT' },
    });

    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        expect.objectContaining({
          category: 'PAYMENT',
          status: 'OPEN',
        }),
      ),
    );
  });

  it('shows endpoint diagnostics and retry when alerts fail to load', async () => {
    list.mockRejectedValueOnce({
      response: { status: 403, data: { message: 'Forbidden' } },
    });

    render(<AdminMonitoringPage />);

    expect(await screen.findByText('Operational alerts did not load.')).toBeTruthy();
    expect(screen.getByText('Forbidden')).toBeTruthy();
    expect(
      screen.getByText(
        'Request: /admin/alerts | Status: 403 | Required permission: alerts.read',
      ),
    ).toBeTruthy();

    list.mockResolvedValueOnce({
      data: {
        data: {
          items: [alert],
          nextCursor: null,
        },
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });
});
