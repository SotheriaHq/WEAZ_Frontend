import { toast } from 'sonner';
import { showNotice } from '@/components/ui/NoticeModal';
import { BagApi } from '@/api/BagApi';
import type { BagStatus } from '@/api/StoreApi';
import type { MarketItem } from '@/types/market';
import {
  BRAND_BAG_BLOCKED_MESSAGE,
  isBrandAccountBlockedFromBagging,
} from '@/lib/baggingAccess';
import { isBrandOwner } from '@/lib/brandAccess';
import type { AuthUserDto } from '@/types/auth';

export type DesignBagTarget = {
  id: string;
  name: string;
  sourceType: 'DESIGN';
  sourceId: string;
};

export type DesignBagFlow = {
  openAuthPrompt: (product: DesignBagTarget, action: 'OPEN_CUSTOM_FLOW') => void;
  openExistingBag: (product: DesignBagTarget, status: BagStatus) => void;
  openFittings: (product: DesignBagTarget, status: BagStatus) => void;
  openStaleConfirmation: (product: DesignBagTarget, status: BagStatus) => void;
  openCustomFlow: (product: DesignBagTarget, status: BagStatus) => void;
};

/**
 * Canonical design bag source id: prefer legacy collection id (bag/custom-order
 * keys), then design id. Never use media row id.
 */
export function resolveDesignBagSourceId(item: Pick<MarketItem, 'collectionId' | 'legacyCollectionId' | 'designId' | 'id'>): string | null {
  const candidates = [
    item.legacyCollectionId,
    item.collectionId,
    item.designId,
  ];
  for (const candidate of candidates) {
    const value = typeof candidate === 'string' ? candidate.trim() : '';
    if (value) return value;
  }
  return null;
}

export function buildDesignBagTarget(item: MarketItem): DesignBagTarget | null {
  const sourceId = resolveDesignBagSourceId(item);
  if (!sourceId) return null;
  return {
    id: sourceId,
    name: item.collectionTitle || 'this design',
    sourceType: 'DESIGN',
    sourceId,
  };
}

export function ownsDesignBrand(
  user: Pick<AuthUserDto, 'id' | 'type' | 'brandMemberships' | 'activeBrandId' | 'storeId' | 'brandFullName'> | null | undefined,
  brandId?: string | null,
): boolean {
  const id = typeof brandId === 'string' ? brandId.trim() : '';
  if (!id || !user) return false;
  return user.id === id || isBrandOwner(user, id);
}

/**
 * Single shared design-bag path for DesignCard, DesignViewModal, and any future surfaces.
 * Keeps card vs modal behavior identical (client-reported inconsistency).
 */
export async function runDesignBagFlow(options: {
  item: MarketItem;
  user: AuthUserDto | null | undefined;
  isAuthenticated: boolean;
  bagFlow: DesignBagFlow | null | undefined;
  /** When set, caller may open a custom composer with this configuration id. */
  onOpenCustomComposer?: (configurationId: string) => void | Promise<void>;
}): Promise<'handled' | 'blocked' | 'error'> {
  const { item, user, isAuthenticated, bagFlow, onOpenCustomComposer } = options;

  if (isBrandAccountBlockedFromBagging(user)) {
    toast.info(BRAND_BAG_BLOCKED_MESSAGE);
    return 'blocked';
  }

  if (ownsDesignBrand(user, item.brandId)) {
    toast.info('Brands cannot place custom orders on their own designs.');
    return 'blocked';
  }

  const designTarget = buildDesignBagTarget(item);
  if (!designTarget) {
    toast.error('Design reference is unavailable for bagging.');
    return 'error';
  }

  if (!bagFlow) {
    toast.error('Bag is unavailable right now.');
    return 'error';
  }

  if (!isAuthenticated) {
    bagFlow.openAuthPrompt(designTarget, 'OPEN_CUSTOM_FLOW');
    return 'handled';
  }

  try {
    const status = await BagApi.getSourceBagStatus('DESIGN', designTarget.sourceId);
    const duplicateClasses = status.duplicateState?.classifications ?? [];

    if (status.custom.alreadyBagged || duplicateClasses.includes('IN_BAG')) {
      bagFlow.openExistingBag(designTarget, status);
      toast.info('This custom request is already in your bag.');
      return 'handled';
    }
    if (duplicateClasses.includes('SUBMITTED_UNPAID')) {
      bagFlow.openExistingBag(designTarget, status);
      toast.info('Resume this custom request from My Bag.');
      return 'handled';
    }
    if (duplicateClasses.includes('PAID_ACTIVE')) {
      toast.error('You already have an active paid custom order for this design.');
      return 'blocked';
    }
    if (duplicateClasses.includes('COMPLETED_BLOCKED')) {
      toast.error(status.duplicateState?.reason || 'This completed custom order cannot be repeated.');
      return 'blocked';
    }

    // Always honor canBag / DISABLED — DesignViewModal previously bypassed this
    // and opened the composer while the card showed "source is unavailable".
    if (!status.canBag || status.ui.defaultAction === 'DISABLED') {
      showNotice({
      title: 'Not available',
      message: status.ui.disabledReason || 'This design cannot be bagged right now.',
    });
      return 'blocked';
    }

    if (status.ui.defaultAction === 'OPEN_FITTINGS') {
      bagFlow.openFittings(designTarget, status);
      return 'handled';
    }

    if (
      status.ui.defaultAction === 'CONFIRM_STALE_FITTINGS' ||
      status.custom.requiresStaleConfirmation ||
      status.custom.freshnessState === 'STALE' ||
      status.custom.freshnessState === 'VERY_STALE'
    ) {
      bagFlow.openStaleConfirmation(designTarget, status);
      return 'handled';
    }

    if (status.ui.defaultAction === 'OPEN_CUSTOM_FLOW') {
      const configurationId = status.custom.configurationId;
      if (configurationId && onOpenCustomComposer) {
        await onOpenCustomComposer(configurationId);
        return 'handled';
      }
      bagFlow.openCustomFlow(designTarget, status);
      return 'handled';
    }

    showNotice({
      title: 'Not available',
      message: status.ui.disabledReason || 'This design cannot be bagged right now.',
    });
    return 'blocked';
  } catch (error: any) {
    toast.error(error?.response?.data?.message || 'Unable to bag this design.');
    return 'error';
  }
}
