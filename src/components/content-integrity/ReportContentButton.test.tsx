import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReportContentButton from './ReportContentButton';

const {
  getReportReasonCodes,
  reportContent,
  toastSuccess,
} = vi.hoisted(() => ({
  getReportReasonCodes: vi.fn(),
  reportContent: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('@/api/AdminApi', () => ({
  contentIntegrityApi: {
    getReportReasonCodes,
    reportContent,
  },
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

vi.mock('@/components/forms/UniversalSelect', () => ({
  default: ({
    label,
    value,
    onChange,
    options,
    error,
  }: {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
    error?: string;
  }) => (
    <label>
      {label ?? 'Reason'}
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

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
  },
}));

describe('ReportContentButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getReportReasonCodes.mockResolvedValue({
      data: {
        data: [
          {
            code: 'WRONG_OR_UNRELATED_IMAGE',
            label: 'Wrong or unrelated image',
          },
        ],
      },
    });
    reportContent.mockResolvedValue({ data: { data: { duplicate: false } } });
  });

  afterEach(() => {
    cleanup();
  });

  it('submits a content report with a selected reason and optional note', async () => {
    render(
      <ReportContentButton
        targetType="PRODUCT"
        targetId="product-1"
        mediaId="media-1"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Report/i }));

    expect(await screen.findByRole('dialog', { name: /Report content/i })).toBeTruthy();
    await waitFor(() => expect(getReportReasonCodes).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText(/Reason/i), {
      target: { value: 'WRONG_OR_UNRELATED_IMAGE' },
    });
    fireEvent.change(screen.getByPlaceholderText('Optional details'), {
      target: { value: 'The photo does not match this listing.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Submit report/i }));

    await waitFor(() =>
      expect(reportContent).toHaveBeenCalledWith({
        targetType: 'PRODUCT',
        targetId: 'product-1',
        mediaId: 'media-1',
        reasonCode: 'WRONG_OR_UNRELATED_IMAGE',
        note: 'The photo does not match this listing.',
      }),
    );
    expect(toastSuccess).toHaveBeenCalledWith('Report submitted');
    expect(await screen.findByText('Thanks. This report is now in the review queue.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Reported/i })).toBeDisabled();
  });
});
