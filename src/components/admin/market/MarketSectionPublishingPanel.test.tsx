import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import MarketSectionPublishingPanel from './MarketSectionPublishingPanel';

const api = vi.hoisted(() => ({
  getSectionTemplates: vi.fn(),
  getSectionLifecycle: vi.fn(),
  getSectionVersions: vi.fn(),
  saveSectionDraft: vi.fn(),
  previewSectionDraft: vi.fn(),
  publishSection: vi.fn(),
  changeSectionStatus: vi.fn(),
  restoreSectionVersion: vi.fn(),
}));

vi.mock('@/api/AdminApi', () => ({ adminMarketGovernanceApi: api }));

vi.mock('@/components/forms/UniversalSelect', () => ({
  default: ({
    label,
    value,
    options,
  }: {
    label?: string;
    value: string;
    options: Array<{ value: string; label: string }>;
  }) => (
    <label>
      {label}
      <select aria-label={label} value={value} onChange={() => undefined}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  ),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const ok = <T,>(data: T) => Promise.resolve({ data });

const draftSpec = {
  key: 'adire-casual',
  version: 1,
  template: 'CATALOG_FILTER',
  title: 'Adire casual',
  status: 'ACTIVE',
  filters: { tags: ['adire'] },
};

beforeEach(() => {
  api.getSectionTemplates.mockReturnValue(
    ok([
      { template: 'CATALOG_FILTER', title: 'Explore the Market', policy: 'recency', entityType: 'PRODUCT', sorts: [], signedInOnly: false, regional: false },
      { template: 'AFFINITY', title: 'Picked for you', policy: 'quality_diverse', entityType: 'PRODUCT', sorts: [], signedInOnly: true, regional: false },
    ]),
  );
  api.getSectionLifecycle.mockReturnValue(
    ok({
      sectionKey: 'adire-casual',
      draft: { spec: draftSpec, presentation: {} },
      draftRevision: 3,
      published: null,
      publishedVersion: 0,
      hasUnpublishedDraft: true,
    }),
  );
  api.getSectionVersions.mockReturnValue(ok({ sectionKey: 'adire-casual', items: [] }));
  api.previewSectionDraft.mockReturnValue(
    ok({
      sectionKey: 'adire-casual',
      draftRevision: 3,
      viewer: 'guest',
      preview: {
        title: 'Adire casual',
        subtitle: null,
        template: 'CATALOG_FILTER',
        productList: true,
        fallbackUsed: false,
        fallbackReason: null,
        candidateCount: 6,
        minItems: 2,
        items: [{ id: 'p1', title: 'Adire wrap', entityType: 'PRODUCT', imageUrl: null, fileId: null, price: 5000, currency: 'NGN' }],
      },
    }),
  );
  api.publishSection.mockReturnValue(ok({ sectionKey: 'adire-casual', version: 1, publishedAt: '', status: 'ACTIVE' }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderPanel = (canRelease: boolean) =>
  render(<MarketSectionPublishingPanel sectionKeys={['adire-casual']} canWrite canRelease={canRelease} />);

describe('MarketSectionPublishingPanel', () => {
  it('publishes only the previewed draft revision, with a reason', async () => {
    renderPanel(true);
    const publish = await screen.findByRole('button', { name: 'Publish' });
    expect(publish).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Preview as a shopper' }));
    expect(await screen.findByText('Adire wrap')).toBeInTheDocument();
    await waitFor(() => expect(publish).toBeEnabled());

    fireEvent.change(screen.getByLabelText('Reason for this change'), { target: { value: 'Adire week' } });
    fireEvent.click(publish);
    await waitFor(() =>
      expect(api.publishSection).toHaveBeenCalledWith('adire-casual', { draftRevision: 3, reason: 'Adire week' }),
    );
  });

  it('keeps Publish off without the release grant, even after a preview', async () => {
    renderPanel(false);
    fireEvent.click(await screen.findByRole('button', { name: 'Preview as a shopper' }));
    await screen.findByText('Adire wrap');
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
    expect(screen.getByText('Publishing needs "Release governance changes".')).toBeInTheDocument();
  });

  it('needs a fresh preview after any edit and never offers personal templates', async () => {
    renderPanel(true);
    fireEvent.click(await screen.findByRole('button', { name: 'Preview as a shopper' }));
    await screen.findByText('Adire wrap');
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Adire weekend' } });
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Preview as a shopper' })).toBeDisabled();

    const template = screen.getByLabelText('Template');
    expect(template.querySelectorAll('option')).toHaveLength(1);
    expect(screen.queryByRole('option', { name: 'Picked for you' })).not.toBeInTheDocument();
  });
});
