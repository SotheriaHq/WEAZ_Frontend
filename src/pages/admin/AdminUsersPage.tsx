import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminBreadcrumb from '@/components/admin/AdminBreadcrumb';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import AccountsPanel from './panels/AccountsPanel';
import BrandsPanel from './panels/BrandsPanel';
import InReviewPanel from './panels/InReviewPanel';
import ReactivationRequestsSection from './panels/ReactivationRequestsSection';
import CreateAdminModal from './modals/CreateAdminModal';
import AdminCredentialsModal from './modals/AdminCredentialsModal';

/**
 * Unified admin Users console.
 *
 * A brand account IS a user (`type === 'BRAND'`), so users, brands, and admins
 * are all managed here through one screen with four tabs — Shoppers, Brands,
 * In Review, Team — each opening the shared AccountManageModal for the full
 * account lifecycle. Replaces the separate Brands and Verification screens.
 */

type TabKey = 'shoppers' | 'brands' | 'in-review' | 'team';

interface TabDef {
  key: TabKey;
  label: string;
  emoji: string;
  /** Any-of permissions required to see the tab. */
  permissions: string[];
}

const TAB_DEFS: TabDef[] = [
  { key: 'shoppers', label: 'Shoppers', emoji: '🛍️', permissions: ['USERS_READ'] },
  { key: 'brands', label: 'Brands', emoji: '🏷️', permissions: ['BRANDS_READ'] },
  { key: 'in-review', label: 'Store Verifications', emoji: '🪪', permissions: ['BRANDS_VERIFY'] },
  { key: 'team', label: 'Team', emoji: '🛡️', permissions: ['USERS_READ'] },
];

const AdminUsersPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission, isSuperAdmin } = useAdminPermissions();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAdminCredentials, setNewAdminCredentials] = useState<null | { email: string; temporaryPassword: string }>(null);
  const [refreshTeamKey, setRefreshTeamKey] = useState(0);

  const canCreateAdmin = isSuperAdmin && hasPermission('USERS_ROLE_ASSIGN_ADMIN');

  const visibleTabs = useMemo(
    () =>
      TAB_DEFS.filter((tab) =>
        isSuperAdmin || tab.permissions.some((code) => hasPermission(code)),
      ),
    [hasPermission, isSuperAdmin],
  );

  const requestedTab = (searchParams.get('tab') as TabKey | null) ?? null;
  const activeTab: TabKey =
    requestedTab && visibleTabs.some((t) => t.key === requestedTab)
      ? requestedTab
      : visibleTabs[0]?.key ?? 'shoppers';

  const selectTab = (key: TabKey) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', key);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="relative space-y-5">
      <AdminBreadcrumb segments={[{ label: 'Users' }]} />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Users</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Shoppers, brands, and team — full account lifecycle in one place.
          </p>
        </div>
        {activeTab === 'team' && canCreateAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
          >
            ➕ Create Admin
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-gray-200/80 pb-px dark:border-white/10">
        {visibleTabs.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => selectTab(tab.key)}
              aria-current={active ? 'page' : undefined}
              className={`-mb-px shrink-0 rounded-t-xl border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                active
                  ? 'border-purple-600 text-purple-700 dark:border-purple-400 dark:text-purple-300'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <span className="mr-1.5" aria-hidden>{tab.emoji}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active panel */}
      {activeTab === 'shoppers' && (
        <>
          <AccountsPanel mode="shoppers" />
          <ReactivationRequestsSection />
        </>
      )}
      {activeTab === 'brands' && <BrandsPanel />}
      {activeTab === 'in-review' && <InReviewPanel />}
      {activeTab === 'team' && <AccountsPanel key={refreshTeamKey} mode="team" />}

      {/* Create Admin flow (Team) */}
      <CreateAdminModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={(result) => {
          setRefreshTeamKey((k) => k + 1);
          if (result.temporaryPassword) {
            setNewAdminCredentials({ email: result.email, temporaryPassword: result.temporaryPassword });
          }
        }}
      />
      {newAdminCredentials && (
        <AdminCredentialsModal
          open
          onClose={() => setNewAdminCredentials(null)}
          email={newAdminCredentials.email}
          temporaryPassword={newAdminCredentials.temporaryPassword}
        />
      )}
    </div>
  );
};

export default AdminUsersPage;
