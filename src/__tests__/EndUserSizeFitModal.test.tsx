import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EndUserSizeFitModal } from '../pages/profile/EndUserSizeFitModal';
import type { SizeFitProfile } from '../types/sizeFit';

const mockProfile: SizeFitProfile = {
  id: 'sf-1',
  userId: 'u-1',
  visibility: 'PRIVATE',
  sharePolicy: 'REQUIRE_PERMISSION',
  notifyOnShare: true,
  requireUpdateEveryDays: 14,
  version: 1,
  preferredLengthUnit: 'CM',
  preferredWeightUnit: 'KG',
  fitPreference: 'REGULAR',
  label: 'Default',
  measurements: { inseam: 80, sleeve: 60 },
  baselineMeasurementPoints: [
    { key: 'inseam', label: 'Inseam', category: 'BOTTOM', required: true, minValueCm: 40, maxValueCm: 110 },
    { key: 'sleeve', label: 'Sleeve Length', category: 'TOP', required: true, minValueCm: 30, maxValueCm: 80 },
  ],
  notes: 'Tailored fit preference',
  lastUpdatedAt: null,
  nextReminderAt: null,
  isUpdateDue: false,
};

describe('EndUserSizeFitModal', () => {
  it('does not render when open is false', () => {
    const { container } = render(
      <EndUserSizeFitModal
        open={false}
        loading={false}
        saving={false}
        profile={mockProfile}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders modal with pinned header without truncation and pinned footer with buttons', () => {
    render(
      <EndUserSizeFitModal
        open={true}
        loading={false}
        saving={false}
        profile={mockProfile}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    const heading = screen.getByRole('heading', { name: /custom size\/fits/i });
    expect(heading).toBeInTheDocument();
    expect(heading.className).not.toContain('truncate');

    const closeButtons = screen.getAllByRole('button', { name: /close/i });
    expect(closeButtons.length).toBeGreaterThanOrEqual(2);

    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    expect(saveBtn).toBeInTheDocument();

    // Verify footer is rendered as sibling holding the action buttons
    const footer = saveBtn.closest('footer');
    expect(footer).toBeInTheDocument();
  });

  it('calls onClose when Close button or top-right X is clicked', () => {
    const onClose = vi.fn();
    render(
      <EndUserSizeFitModal
        open={true}
        loading={false}
        saving={false}
        profile={mockProfile}
        onClose={onClose}
        onSave={vi.fn()}
      />,
    );

    const closeButtons = screen.getAllByRole('button', { name: /close/i });
    fireEvent.click(closeButtons[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('submits updated measurements on Save changes', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <EndUserSizeFitModal
        open={true}
        loading={false}
        saving={false}
        profile={mockProfile}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    const inseamInput = document.querySelector('input[name="inseam"]') as HTMLInputElement;
    expect(inseamInput).toBeInTheDocument();
    fireEvent.change(inseamInput, { target: { value: '85' } });

    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          measurements: expect.objectContaining({ inseam: 85 }),
          preferredLengthUnit: 'CM',
          visibility: 'PRIVATE',
        }),
      );
    });
  });
});
