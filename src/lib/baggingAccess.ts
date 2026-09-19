import type { AuthUserDto } from '@/types/auth';

/**
 * Brand accounts (UserType.BRAND) are sellers only — they must never bag items.
 * Project rule: buyer-only commerce. Enforce on every bag entry point.
 */
export function isBrandAccountBlockedFromBagging(
  user?: Pick<AuthUserDto, 'type'> | null,
): boolean {
  return user?.type === 'BRAND';
}

export const BRAND_BAG_BLOCKED_MESSAGE =
  'Brand accounts cannot bag items. Use a buyer account to shop.';
