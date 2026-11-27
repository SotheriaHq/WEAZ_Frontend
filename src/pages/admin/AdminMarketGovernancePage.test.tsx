import { cleanup, render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AdminMarketGovernancePage from './AdminMarketGovernancePage';

const {
  getReleaseStatus,
  getSections,
  getSuggestionBlocks,
  getAuditLogs,
} = vi.hoisted(() => ({
  getReleaseStatus: vi.fn(),
  getSections: vi.fn(),
  getSuggestionBlocks: vi.fn(),
  getAuditLogs: vi.fn(),
}));

vi.mock('@/api/AdminApi', () => ({
  adminMarketGovernanceApi: {
    getReleaseStatus,
    getSections,
    getSuggestionBlocks,
    getAuditLogs,
    updateSection: vi.fn(),
    createSuggestionBlock: vi.fn(),
    updateSuggestionBlock: vi.fn(),
  },
}));

vi.mock('@/hooks/useAdminPermissions', () => ({
  useAdminPermissions: () => ({
    hasPermission: () => true,
  }),
}));

vi.mock('@/components/admin/AdminBreadcrumb', () => ({
  default: () => <nav aria-label="Breadcrumb">Market Governance</nav>,
}));

vi.mock('@/components/forms/UniversalSelect', () => ({
  default: ({
    label,
    value,
  }: {
    label?: string;
    value: string;
  }) => (
    <label>
      {label}
      <select aria-label={label} value={value} onChange={() => undefined} />
    </label>
  ),
}));

vi.mock('@/components/ui/Modal', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('AdminMarketGovernancePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getReleaseStatus.mockResolvedValue({
      data: {
        data: {
          rankingEnabled: false,
          rankingDefaultDisabled: true,
          deterministicFallbackEnabled: true,
          phase14Required: true,
          shadowMode: true,
          configReadStatus: 'code-defaults',
          productionReady: false,
        },
      },
    });
    getSections.mockResolvedValue({
      data: { data: { items: [], configReadStatus: 'code-defaults' } },
    });
    getSuggestionBlocks.mockResolvedValue({
      data: { data: { items: [], configReadStatus: 'code-defaults' } },
    });
    getAuditLogs.mockResolvedValue({
      data: { data: { items: [], nextCursor: null } },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders field explanations for market governance operators', async () => {
    render(<AdminMarketGovernancePage />);

    expect(await screen.findByText('Release Status')).toBeTruthy();
    expect(screen.getByText('What this page controls')).toBeTruthy();
    expect(
      screen.getByText(
        'Controls whether backend ranking is allowed to influence market ordering. Disabled is the safe release state.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Configurable marketplace rails such as Fresh Drops and Shop by Style. They control labels, limits, order, and View All behavior.',
      ),
    ).toBeTruthy();
  });

  it('no longer offers ranking profile, formula or rollback controls', async () => {
    render(<AdminMarketGovernancePage />);

    expect(await screen.findByText('Release Status')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Ranking Profiles/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Formulas$/i })).toBeNull();
    expect(screen.queryByText(/rollback/i)).toBeNull();
    expect(screen.queryByText('Active ranking profile')).toBeNull();
  });
});
