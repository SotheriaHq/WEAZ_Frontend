import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import {
  getActiveBrandMembership,
  setStoredActiveBrandId,
} from '@/lib/brandAccess';

const roleLabel = (role: string) => role.replace(/_/g, ' ').toLowerCase();

export default function BrandSwitcher() {
  const user = useSelector((state: RootState) => state.user.profile);
  const [open, setOpen] = useState(false);
  const activeMemberships = useMemo(
    () =>
      (user?.brandMemberships ?? []).filter(
        (membership) => membership.status === 'ACTIVE',
      ),
    [user?.brandMemberships],
  );
  const selected =
    getActiveBrandMembership(user) ?? activeMemberships[0] ?? null;

  if (activeMemberships.length <= 1 || !selected) {
    return null;
  }

  const handleSelect = (brandId: string) => {
    if (brandId === selected.brandId) {
      setOpen(false);
      return;
    }
    setStoredActiveBrandId(brandId);
    window.dispatchEvent(
      new CustomEvent('threadly:active-brand-change', {
        detail: { brandId },
      }),
    );
    window.location.reload();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex max-w-[240px] items-center gap-2 rounded-lg border border-[color:var(--border-primary)] bg-[color:var(--surface-secondary)] px-3 py-2 text-left text-sm text-[color:var(--text-primary)] shadow-sm transition hover:bg-[color:var(--surface-tertiary)]"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{selected.brandName || 'Brand workspace'}</span>
          <span className="block truncate text-xs capitalize text-[color:var(--text-secondary)]">
            {roleLabel(selected.role)}
          </span>
        </span>
        <span aria-hidden="true" className="text-xs text-[color:var(--text-secondary)]">
          v
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-72 overflow-hidden rounded-lg border border-[color:var(--border-primary)] bg-[color:var(--surface-primary)] shadow-xl"
        >
          {activeMemberships.map((membership) => {
            const isSelected = membership.brandId === selected.brandId;
            return (
              <button
                key={membership.brandId}
                type="button"
                role="menuitem"
                onClick={() => handleSelect(membership.brandId)}
                className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left text-sm transition hover:bg-[color:var(--surface-secondary)]"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-[color:var(--text-primary)]">
                    {membership.brandName || 'Brand workspace'}
                  </span>
                  <span className="block text-xs capitalize text-[color:var(--text-secondary)]">
                    {roleLabel(membership.role)}
                  </span>
                </span>
                {isSelected ? (
                  <span className="text-xs font-semibold text-[color:var(--accent-primary)]">
                    Active
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
