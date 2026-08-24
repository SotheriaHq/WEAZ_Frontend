import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useDispatch, useSelector } from 'react-redux';
import { SavedTab } from './tabs/SavedTab';
import { PatchesTab } from './tabs/PatchesTab';
import { OrdersPanel, type OrdersPanelSelection } from './tabs/OrdersPanel';
import { apiClient } from '@/api/httpClient';
import { ProfilePhotoViewApi } from '@/api/ProfilePhotoViewApi';
import type { AppDispatch, RootState } from '@/store';
import { setUser } from '@/features/userSlice';
import { EndUserQuickEditModal } from './EndUserQuickEditModal';
import { EndUserSizeFitModal } from './EndUserSizeFitModal';
import { EndUserSizeFitQuickShareModal } from './EndUserSizeFitQuickShareModal';
import { EndUserProfileQrModal } from './EndUserProfileQrModal';
import { SizeFitApi } from '@/api/SizeFitApi';
import type {
  ComputedSizeFitProfile,
  SizeFitProfile,
  SizeFitSharesPayload,
  SizingRegion,
} from '@/types/sizeFit';
import ProfileActionsBar, { type ProfileAction } from '@/components/profile/ProfileActionsBar';
import { buildProfileUrl, shareOrCopyLink } from '@/utils/publicLinks';
import { customOrdersBuyerApi, type CustomOrderChartFamily } from '@/api/CustomOrderApi';
import { DISPLAY_CHART_OPTIONS } from '@/lib/sizeCharts';
import ImageWithFallback from '@/components/ImageWithFallback';
import MediaRenderer from '@/components/media/MediaRenderer';
import ProfileImageModal from '@/components/profile/ProfileImageModal';
import { getAvatarFallback, resolveProfileImageSource } from '@/utils/profileImage';
import {
  createUnviewedProfilePhotoViewState,
  type ProfilePhotoViewState,
} from '@/types/profilePhoto';
import {
  fetchDisplayChartPreferenceQuery,
  fetchMyComputedSizeFitQuery,
  fetchMySizeFitProfileQuery,
  fetchMySizeFitSharesQuery,
  fetchMyUserProfileQuery,
  usePublicUserProfileQuery,
} from '@/query/queries';
import { queryKeys } from '@/query/queryKeys';
import {
  WEB_UPLOAD_POLICIES,
  assertValidUploadFile,
  getUploadValidationMessage,
} from '@/utils/uploadValidation';

interface UserProfile {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profileImage?: string;
  profileImageId?: string | null;
  profileImageFile?: {
    id: string;
    s3Url: string;
    fileName?: string;
    originalName?: string;
    createdAt?: string;
    updatedAt?: string;
  } | null;
  bannerImage?: string;
  address?: string;
  profileVisibility: 'UNLOCKED' | 'LOCKED';
  location?: string;
  profilePhotoUpdatedAt?: string | null;
  profilePhotoViewState?: ProfilePhotoViewState | null;
  createdAt?: string;
}

const normalizeProfile = (raw: any): UserProfile | null => {
  const payload = raw?.data ?? raw;
  const source = payload?.user ?? payload?.profile ?? payload;
  if (!source || typeof source !== 'object' || !source.id) return null;

  return {
    id: source.id,
    username: source.username ?? '',
    firstName: source.firstName ?? '',
    lastName: source.lastName ?? '',
    profileImage: source.profileImage ?? undefined,
    profileImageId: source.profileImageId ?? null,
    profileImageFile: source.profileImageFile ?? null,
    bannerImage: source.bannerImage ?? undefined,
    address: source.address ?? undefined,
    location: source.location ?? source.address ?? undefined,
    profileVisibility: source.profileVisibility === 'LOCKED' ? 'LOCKED' : 'UNLOCKED',
    profilePhotoUpdatedAt: source.profilePhotoUpdatedAt ?? null,
    profilePhotoViewState: source.profilePhotoViewState ?? null,
    createdAt: typeof source.createdAt === 'string' ? source.createdAt : undefined,
  };
};



const describeAlphaFit = (value?: string | null): string | null => {
  if (!value) return null;

  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/^2XL$/, 'XXL')
    .replace(/^3XL$/, 'XXXL')
    .replace(/^4XL$/, 'XXXXL');
  const labels: Record<string, string> = {
    XXS: 'Extra Extra Small',
    XS: 'Extra Small',
    S: 'Small',
    M: 'Medium',
    L: 'Large',
    XL: 'Extra Large',
    XXL: 'Extra Extra Large',
    XXXL: 'Extra Extra Extra Large',
  };

  return labels[normalized] ? `${labels[normalized]} (${normalized})` : normalized;
};

/**
 * Canonical slot for a stored measurement key, mirroring the backend's
 * `measurement-normalization.service.ts`.
 *
 * The API does not store one key per measurement. It stores up to THREE: the
 * key the shopper filled in, the canonical slot it maps to, and the gendered
 * registry spelling — so a single "shoulder width, 59" comes back as
 * SHOULDER_WIDTH, SHOULDER and WOMEN_SHOULDER_WIDTH. Rendering the raw object
 * therefore paints the same body measurement two or three times, which is the
 * duplicated carousel.
 */
const FITTING_CANONICAL_SLOTS: Record<string, string> = {
  HEIGHT: 'HEIGHT',
  BODY_HEIGHT: 'HEIGHT',
  STATURE: 'HEIGHT',
  CHEST: 'CHEST_BUST',
  BUST: 'CHEST_BUST',
  FULL_BUST: 'CHEST_BUST',
  CHEST_BUST: 'CHEST_BUST',
  CHEST_FULL_BUST: 'CHEST_BUST',
  WAIST: 'WAIST',
  NATURAL_WAIST: 'WAIST',
  HIP: 'HIP_SEAT',
  HIPS: 'HIP_SEAT',
  SEAT: 'HIP_SEAT',
  HIP_SEAT: 'HIP_SEAT',
  SHOULDER: 'SHOULDER',
  SHOULDER_WIDTH: 'SHOULDER',
  SLEEVE: 'SLEEVE_LENGTH',
  SLEEVE_LENGTH: 'SLEEVE_LENGTH',
  SLEEVE_LENGTH_LONG: 'SLEEVE_LENGTH',
  SLEEVE_LENGTH_SHORT: 'SLEEVE_LENGTH',
  ARM_LENGTH: 'SLEEVE_LENGTH',
  INSEAM: 'INSEAM',
  INSIDE_LEG: 'INSEAM',
  NECK: 'NECK_COLLAR',
  COLLAR: 'NECK_COLLAR',
  COLLAR_SIZE: 'NECK_COLLAR',
  NECK_GIRTH: 'NECK_COLLAR',
  NECK_COLLAR: 'NECK_COLLAR',
};

const CANONICAL_SLOT_NAMES = new Set(Object.values(FITTING_CANONICAL_SLOTS));

const stripGenderPrefix = (key: string) =>
  key.replace(/^(MEN|WOMEN|MENS|WOMENS|UNISEX)_/i, '').toUpperCase();

/**
 * Which of several spellings of one measurement to show.
 *
 * Highest wins. The key the shopper actually filled in is the one the sheet
 * labelled, so it reads best — that is the spelling that is neither a bare
 * canonical slot nor gender-namespaced.
 */
const measurementKeyRank = (key: string): number => {
  const isGendered = /^(MEN|WOMEN|MENS|WOMENS|UNISEX)_/i.test(key);
  if (isGendered) return 0;
  return CANONICAL_SLOT_NAMES.has(key.toUpperCase()) ? 1 : 2;
};

/**
 * Collapse the API's fan-out back to one entry per real measurement.
 *
 * Keyed on slot AND value, not slot alone: SLEEVE_LENGTH_LONG at 71 and
 * SLEEVE_LENGTH at 71 are the same number written twice and must merge, while a
 * separately-entered SLEEVE_LENGTH_SHORT at 25 is a different measurement and
 * has to survive. Keys outside the canonical table (there are 38 registry
 * points and only 8 canonical slots) are always kept — they have no duplicate
 * to merge with.
 */
function dedupeMeasurementEntries(
  entries: Array<[string, unknown]>,
): Array<[string, unknown]> {
  const bySlot = new Map<string, [string, unknown]>();
  const passthrough: Array<[string, unknown]> = [];

  for (const entry of entries) {
    const [key, value] = entry;
    const slot = FITTING_CANONICAL_SLOTS[stripGenderPrefix(key)];
    if (!slot) {
      passthrough.push(entry);
      continue;
    }
    const dedupeKey = `${slot}:${String(value).trim()}`;
    const existing = bySlot.get(dedupeKey);
    if (!existing || measurementKeyRank(key) > measurementKeyRank(existing[0])) {
      bySlot.set(dedupeKey, entry);
    }
  }

  return [...bySlot.values(), ...passthrough];
}

/**
 * Renders one marquee row, cloning its content only when it actually overflows.
 *
 * The seamless loop works by holding the content twice and translating -50%. If
 * the content is NARROWER than the viewport there is no gap for the clone to
 * slide into, so both copies are simply on screen at once and every chip appears
 * twice — read, correctly, as duplicate data. A fixed chip-count threshold
 * cannot decide this: the same four chips overflow a phone and fit a desktop.
 *
 * So measure. `ResizeObserver` watches both the track and its container and the
 * clone appears only when it is needed; when it is not, the row renders once and
 * holds still, which is what "start again after the last one" means for a list
 * that already fits.
 */
const FittingsMarqueeRow: React.FC<{
  row: Array<[string, unknown]>;
  /**
   * Scroll the opposite way. Existed so a second, stacked row could counter-run
   * against the first; the fittings now render as ONE row, so it defaults off
   * and is kept only for a caller that genuinely wants the reverse direction.
   */
  alt?: boolean;
  unitLabel: string;
  formatLabel: (key: string) => string;
  onSelect: () => void;
}> = ({ row, alt = false, unitLabel, formatLabel, onSelect }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;

    const measure = () => {
      // Compare the FIRST copy's width against the container. `scrollWidth`
      // would already include the clone once it exists, which would latch the
      // decision on permanently.
      const singlePassWidth = overflows ? track.scrollWidth / 2 : track.scrollWidth;
      setOverflows(singlePassWidth > container.clientWidth + 1);
    };

    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(track);
    return () => observer.disconnect();
  }, [overflows, row.length]);

  const chips = overflows ? [...row, ...row] : row;

  return (
    <div ref={containerRef} className="fittings-marquee overflow-hidden">
      <div
        ref={trackRef}
        className={`fittings-marquee-track flex w-max gap-1.5 ${
          overflows ? '' : 'fittings-marquee-track-static'
        } ${alt ? 'fittings-marquee-track-alt' : ''}`}
      >
        {chips.map(([key, value], chipIndex) => (
          <button
            key={`${key}-${chipIndex}`}
            type="button"
            // The clone is decoration; assistive tech must read each fitting once.
            aria-hidden={chipIndex >= row.length || undefined}
            tabIndex={chipIndex >= row.length ? -1 : undefined}
            onClick={onSelect}
            className="shrink-0 rounded-lg border border-gray-200/70 bg-gray-50/80 px-2 py-1 text-xs font-semibold text-gray-700 transition hover:border-indigo-300 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:border-indigo-400/50"
          >
            {formatLabel(String(key))} · {String(value)} {unitLabel}
          </button>
        ))}
      </div>
    </div>
  );
};

/**
 * The chart(s) a display family actually computes against.
 *
 * This returns a LIST, and that is the whole point. It used to return one
 * region and map Nigeria and BOTH hybrids onto `NG_WEST_AFRICA`, so three of
 * the four tabs on this widget issued the identical request and printed the
 * identical number. Switching between them looked broken because it was: there
 * was nothing to switch to.
 *
 * A hybrid is not a third chart, it is two charts read side by side — that is
 * what the word means on the custom-order side, where a hybrid quote is priced
 * off one grade and labelled off another. So it resolves to both of its parts
 * and the widget shows both answers.
 */
const sizeFitRegionsForDisplayChart = (
  family: CustomOrderChartFamily,
): SizingRegion[] => {
  switch (family) {
    case 'UK':
      return ['UK'];
    case 'US':
      return ['US'];
    case 'NIGERIA':
      return ['NG_WEST_AFRICA'];
    case 'HYBRID_UK_NIGERIA':
      return ['UK', 'NG_WEST_AFRICA'];
    case 'HYBRID_US_NIGERIA':
      return ['US', 'NG_WEST_AFRICA'];
    case 'ASIA':
    default:
      return ['INTERNATIONAL'];
  }
};

/** Short region tag used only when a hybrid has to show two answers at once. */
const REGION_SHORT_LABEL: Record<SizingRegion, string> = {
  UK: 'UK',
  US: 'US',
  EU: 'EU',
  NG_WEST_AFRICA: 'NG',
  INTERNATIONAL: 'INT',
};

const resolveComputedSizeLabel = (computed?: ComputedSizeFitProfile | null): string | null => {
  if (!computed) return null;
  const primaryBreakdown =
    computed.categoryBreakdown?.tops ??
    Object.values(computed.categoryBreakdown ?? {}).find(
      (entry) => entry?.recommendedSize || entry?.estimatedSize || entry?.displayRange,
    ) ??
    null;

  return (
    computed.estimatedSize ??
    primaryBreakdown?.recommendedSize ??
    primaryBreakdown?.estimatedSize ??
    computed.displayRange ??
    primaryBreakdown?.displayRange ??
    null
  );
};

const extractAlphaSizeFromLabel = (value?: string | null): string | null => {
  if (!value) return null;
  const match = value.toUpperCase().match(/\b(4XL|3XL|2XL|XXXL|XXL|XL|L|M|S|XS|XXS)\b/);
  return match?.[1] ?? null;
};

export const EndUserProfile: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const currentUser = useSelector((state: RootState) => state.user.profile);
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isQuickEditOpen, setIsQuickEditOpen] = useState(false);
  const [savingQuickEdit, setSavingQuickEdit] = useState(false);
  const [isSizeFitOpen, setIsSizeFitOpen] = useState(false);
  const [isQuickShareOpen, setIsQuickShareOpen] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [sizeFitLoading, setSizeFitLoading] = useState(false);
  const [sizeFitSaving, setSizeFitSaving] = useState(false);
  const [sizeFitProfile, setSizeFitProfile] = useState<SizeFitProfile | null>(null);
  const [sizeFitShares, setSizeFitShares] = useState<SizeFitSharesPayload | null>(null);
  const [displayChartFamily, setDisplayChartFamily] = useState<CustomOrderChartFamily>('UK');
  const [computedSize, setComputedSize] = useState<string | null>(null);
  const [computedAlphaSize, setComputedAlphaSize] = useState<string | null>(null);
  const [computedMissingBaseline, setComputedMissingBaseline] = useState<string[]>([]);
  /**
   * Why there is no size, when it is not the shopper's fault.
   *
   * The widget had exactly two states: a size, or "Add <fields> to see your
   * size". When the backend answers with every measurement present but no
   * result — no approved sizing chart exists for the region, which is a data
   * problem on the server, not something the shopper can act on — both were
   * wrong, so it rendered a bare em dash and explained nothing. The response
   * carries a `warnings` array saying precisely this; it was being discarded.
   */
  const [computedWarning, setComputedWarning] = useState<string | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartSaving, setChartSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  /**
   * The just-uploaded blob, held under the incoming remote image.
   *
   * On success the preview used to be revoked immediately and the avatar
   * switched to the new file id — which starts resolving a signed URL from
   * scratch. For the whole of that round trip there was nothing to paint, so
   * the photo the shopper had just watched upload blinked out and the initials
   * came back. Keeping the blob underneath until the real image reports it has
   * painted makes the handover a crossfade with nothing missing in between.
   */
  const [avatarSettlingUrl, setAvatarSettlingUrl] = useState<string | null>(null);
  const [avatarActionsOpen, setAvatarActionsOpen] = useState(false);
  /**
   * Which way the avatar menu opens.
   *
   * It was hard-coded to `top-full` — always downward. The trigger sits at the
   * BOTTOM-RIGHT of the avatar, so on a phone, or any short viewport, the menu
   * opened straight off the bottom of the screen with no way to reach "Remove
   * photo". Measured on open, because whether there is room depends on scroll
   * position, not on breakpoint.
   */
  const [avatarMenuDirection, setAvatarMenuDirection] = useState<'down' | 'up'>('down');
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const avatarActionsRef = useRef<HTMLDivElement | null>(null);

  const isOwner = !id || currentUser?.id === id;
  const profileId = id ?? currentUser?.id;
  const publicProfileQuery = usePublicUserProfileQuery(profileId, {
    enabled: Boolean(!isOwner && profileId),
  });
  const availableTabs = useMemo(() => (isOwner ? ['Saved', 'Patches', 'Orders'] : ['Patches']), [isOwner]);
  const computedSizingRegions = useMemo(
    () => sizeFitRegionsForDisplayChart(displayChartFamily),
    [displayChartFamily],
  );
  /*
    Joined, because effect deps compare by identity and a fresh array every
    render would re-run the fetch on every render.
  */
  const computedSizingRegionsKey = computedSizingRegions.join(',');
  const tabParam = searchParams.get('tab');
  const derivedTab = (() => {
    if (tabParam === 'orders' && isOwner) return 'Orders';
    return isOwner ? 'Saved' : 'Patches';
  })();
  const [activeTab, setActiveTab] = useState<string>(derivedTab);
  const [ordersSelection, setOrdersSelection] = useState<OrdersPanelSelection | null>(null);

  // Keep activeTab in sync when URL changes (e.g. browser back/forward)
  useEffect(() => {
    setActiveTab(derivedTab);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam]);
  const hasAvatarImage = Boolean(
    avatarPreviewUrl ||
      profile?.profileImage ||
      profile?.profileImageFile ||
      (isOwner && (currentUser?.profileImage || currentUser?.profileImageFile)),
  );

  useEffect(() => {
    let mounted = true;

    const fetchProfile = async () => {
      if (!profileId) {
        if (mounted) {
          setLoading(false);
          setError('Failed to load profile');
        }
        return;
      }

      if (!isOwner) {
        return;
      }

      try {
        if (mounted) {
          setLoading(true);
          setError(null);
        }

        const ownerProfilePayload = await fetchMyUserProfileQuery(queryClient, currentUser?.id ?? profileId);
        const normalized = normalizeProfile(ownerProfilePayload);
        if (!normalized) throw new Error('Invalid profile payload');
        if (mounted) setProfile(normalized);
      } catch (err) {
        if (mounted && isOwner && currentUser) {
          setProfile({
            id: currentUser.id,
            username: currentUser.username ?? '',
            firstName: currentUser.firstName ?? '',
            lastName: currentUser.lastName ?? '',
            profileImage: currentUser.profileImage ?? undefined,
            profileImageId: currentUser.profileImageId ?? null,
            profileImageFile: currentUser.profileImageFile ?? null,
            bannerImage: currentUser.bannerImage ?? undefined,
            address: currentUser.address ?? undefined,
            location: currentUser.address ?? undefined,
            profilePhotoUpdatedAt: currentUser.profilePhotoUpdatedAt ?? null,
            profilePhotoViewState: null,
            profileVisibility:
              (currentUser as any).profileVisibility === 'LOCKED' ? 'LOCKED' : 'UNLOCKED',
            createdAt: currentUser.createdAt,
          });
          setError(null);
        } else if (mounted) {
          setError('Failed to load profile');
        }
        console.error('Error fetching profile:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void fetchProfile();

    return () => {
      mounted = false;
    };
  }, [profileId, isOwner, currentUser, queryClient]);

  useEffect(() => {
    if (isOwner) return;

    if (!profileId) {
      setProfile(null);
      setLoading(false);
      setError('Failed to load profile');
      return;
    }

    if (publicProfileQuery.isLoading && !publicProfileQuery.data) {
      setLoading(true);
      setError(null);
      return;
    }

    if (publicProfileQuery.error) {
      setProfile(null);
      setLoading(false);
      setError('Failed to load profile');
      return;
    }

    if (!publicProfileQuery.data) return;

    const normalized = normalizeProfile(publicProfileQuery.data);
    if (!normalized) {
      setProfile(null);
      setLoading(false);
      setError('Failed to load profile');
      return;
    }

    setProfile(normalized);
    setLoading(false);
    setError(null);
  }, [
    isOwner,
    profileId,
    publicProfileQuery.data,
    publicProfileQuery.error,
    publicProfileQuery.isLoading,
  ]);

  const loadSizeFit = useCallback(async (forceRefresh = false) => {
    if (!isOwner || !currentUser?.id) return;
    setSizeFitLoading(true);
    try {
      const [profileData, shareData] = await Promise.all([
        fetchMySizeFitProfileQuery(queryClient, currentUser.id, { forceRefresh }),
        fetchMySizeFitSharesQuery(queryClient, currentUser.id, { forceRefresh }),
      ]);
      setSizeFitProfile(profileData);
      setSizeFitShares(shareData);
    } catch (err) {
      console.error('Failed to load size fit profile', err);
      toast.error('Unable to load custom size/fits right now.');
    } finally {
      setSizeFitLoading(false);
    }
  }, [currentUser?.id, isOwner, queryClient]);

  const loadComputedSizeFit = useCallback(async (forceRefresh = false) => {
    if (!isOwner || !currentUser?.id) return;
    const regions = computedSizingRegionsKey.split(',') as SizingRegion[];
    setChartLoading(true);
    try {
      /*
        One request per chart in the selection, in parallel.

        Each region is its own query key, so a chart already looked at this
        session resolves from cache and the swap is instant — which is half of
        why the widget no longer jumps when you change tabs. The other half is
        that the previous number stays on screen until this resolves.
      */
      const results = await Promise.all(
        regions.map((region) =>
          fetchMyComputedSizeFitQuery(queryClient, currentUser.id, region, {
            forceRefresh,
          }),
        ),
      );

      const perRegion = regions.map((region, index) => ({
        region,
        computed: results[index],
        label: resolveComputedSizeLabel(results[index]),
      }));
      const answered = perRegion.filter((entry) => Boolean(entry.label));

      /*
        A single chart prints its size bare. A hybrid prints both of its parts
        tagged, because "UK 12" and "NG 14" are different answers to different
        questions and collapsing them to one number would be a guess. When both
        parts agree there is only one answer to give, so the tags are dropped.
      */
      const distinctLabels = Array.from(new Set(answered.map((entry) => entry.label)));
      const nextComputedSize =
        answered.length === 0
          ? null
          : distinctLabels.length === 1
            ? distinctLabels[0]
            : answered
                .map((entry) => `${REGION_SHORT_LABEL[entry.region]} ${entry.label}`)
                .join(' · ');

      setComputedSize(nextComputedSize);
      // The alpha band (S/M/L) is a property of the body, not of the labelling
      // system, so it is read from the first chart that produced one.
      setComputedAlphaSize(extractAlphaSizeFromLabel(answered[0]?.label ?? null));
      setComputedMissingBaseline(
        perRegion[0]?.computed?.missingBaselineMeasurements ?? [],
      );
      /*
        Warnings live per category, not on the envelope — the profile response
        aggregates `categoryBreakdown`, and each entry carries its own
        `warnings[]`. "No approved sizing chart is available" arrives there.

        Only surfaced when NO chart in the selection produced a size. On a
        hybrid where one half answered, the shopper has their size; reporting
        that the other half has no chart is an internal detail that reads as a
        failure.
      */
      setComputedWarning(
        nextComputedSize
          ? null
          : (perRegion
              .flatMap((entry) =>
                Object.values(entry.computed?.categoryBreakdown ?? {}),
              )
              .flatMap((entry) => entry?.warnings ?? [])
              .find((warning) => Boolean(warning)) ?? null),
      );
    } catch (err) {
      setComputedSize(null);
      setComputedAlphaSize(null);
      setComputedMissingBaseline([]);
      setComputedWarning(null);
      console.error('Failed to load computed size fit', err);
    } finally {
      setChartLoading(false);
    }
  }, [computedSizingRegionsKey, currentUser?.id, isOwner, queryClient]);

  useEffect(() => {
    if (!isOwner) return;
    void loadSizeFit();
  }, [isOwner, loadSizeFit]);

  useEffect(() => {
    if (!isOwner) return;
    void loadComputedSizeFit();
  }, [isOwner, loadComputedSizeFit]);

  useEffect(() => {
    let active = true;
    if (!isOwner || !currentUser?.id) return;

    const loadChartProfile = async () => {
      setChartLoading(true);
      try {
        const preference = await fetchDisplayChartPreferenceQuery(queryClient, currentUser.id);
        if (!active) return;
        if (preference) {
          setDisplayChartFamily(preference.displayChartFamily);
        }
      } catch (err) {
        console.error('Failed to load display chart/computed size', err);
      } finally {
        if (active) {
          setChartLoading(false);
        }
      }
    };

    void loadChartProfile();
    return () => {
      active = false;
    };
  }, [currentUser?.id, isOwner, queryClient]);

  useEffect(() => {
    setActiveTab((prev) => (availableTabs.includes(prev) ? prev : availableTabs[0]));
  }, [availableTabs]);

  /**
   * The live object URL, owned by a ref — NOT by an effect's dependency list.
   *
   * This cleanup used to list `[avatarPreviewUrl, avatarSettlingUrl]` and revoke
   * both on every change. React runs an effect's cleanup with the PREVIOUS
   * render's values, so the moment the upload handed the blob from
   * `avatarPreviewUrl` to `avatarSettlingUrl` — two setStates in one commit —
   * the cleanup fired holding the old `avatarPreviewUrl` and revoked the exact
   * URL that had just been handed over. Both <img> tags pointing at it died
   * instantly: the two `blob:… (failed) net::ERR` rows in the network panel.
   *
   * A ref has no dependency list, so a handover cannot trigger a revoke. The URL
   * is released in exactly three places, all deliberate: replacing it with a new
   * upload, the settle callback, and unmount.
   */
  const avatarBlobRef = useRef<string | null>(null);

  const releaseAvatarBlob = useCallback(() => {
    if (avatarBlobRef.current) {
      URL.revokeObjectURL(avatarBlobRef.current);
      avatarBlobRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Unmount only. Empty deps is the point: nothing about a state change should
    // invalidate a blob that is still on screen.
    return () => {
      if (avatarBlobRef.current) {
        URL.revokeObjectURL(avatarBlobRef.current);
        avatarBlobRef.current = null;
      }
    };
  }, []);

  /**
   * Safety net for the crossfade.
   *
   * The blob underlay is cleared when the remote image reports it painted. If
   * that never happens — the signed URL 403s, the network dies — this stops the
   * overlay outliving the upload and masking the real state of the avatar.
   */
  useEffect(() => {
    if (!avatarSettlingUrl) return;
    const timer = setTimeout(() => {
      setAvatarSettlingUrl(null);
      releaseAvatarBlob();
    }, 8000);
    return () => clearTimeout(timer);
  }, [avatarSettlingUrl, releaseAvatarBlob]);

  const handleAvatarSettled = useCallback(() => {
    setAvatarSettlingUrl(null);
    releaseAvatarBlob();
  }, [releaseAvatarBlob]);

  useEffect(() => {
    if (!avatarActionsOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (avatarActionsRef.current && event.target instanceof Node && avatarActionsRef.current.contains(event.target)) {
        return;
      }
      setAvatarActionsOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [avatarActionsOpen]);

  const handleShareProfile = useCallback(async () => {
    if (!profile) return;
    const url = buildProfileUrl({ id: profile.id, username: profile.username });
    await shareOrCopyLink({
      url,
      title: `${profile.firstName} ${profile.lastName}`.trim() || profile.username,
      successMessage: 'Profile link copied.',
      errorMessage: 'Unable to copy profile link.',
    });
  }, [profile]);

  const handleQuickProfileSave = useCallback(
    async (values: { firstName: string; lastName: string; address: string }) => {
      if (!profile) return;
      setSavingQuickEdit(true);
      try {
        const response = await apiClient.patch('/users/me/profile', {
          firstName: values.firstName,
          lastName: values.lastName,
          username: profile.username,
          address: values.address || undefined,
        });

        const payload = response.data?.data ?? response.data;
        const updatedUser = payload?.user ?? payload;

        setProfile((prev) =>
          prev
            ? {
                ...prev,
                firstName: String(updatedUser?.firstName ?? values.firstName),
                lastName: String(updatedUser?.lastName ?? values.lastName),
                address: String(updatedUser?.address ?? values.address ?? ''),
                location: String(updatedUser?.address ?? values.address ?? ''),
              }
            : prev,
        );

        if (isOwner && updatedUser && typeof updatedUser === 'object') {
          dispatch(setUser(updatedUser));
          queryClient.setQueryData(queryKeys.user.meProfile(profile.id), updatedUser);
        }

        toast.success('Profile updated');
        setIsQuickEditOpen(false);
      } catch (err) {
        console.error('Quick profile update failed:', err);
        toast.error('Unable to update profile right now.');
      } finally {
        setSavingQuickEdit(false);
      }
    },
    [dispatch, isOwner, profile, queryClient],
  );

  /**
   * One save for the Custom Size/Fits dialog.
   *
   * Measurements and permissions are still two endpoints — that is the API's
   * shape, not a choice this screen gets to make — but they are now one user
   * action, one spinner and one toast. They run in series rather than
   * `Promise.all` because both write the same `UserSizeFitProfile` row and
   * `requireUpdateEveryDays` belongs to both payloads; concurrent writes would
   * race for it.
   *
   * `updateProfile` returns the whole profile and `updateSettings` a partial,
   * so the settings response is layered on top.
   */
  const handleSaveSizeFit = useCallback(
    async (payload: {
      measurements: Record<string, unknown>;
      notes?: string;
      preferredLengthUnit?: 'CM' | 'IN';
      requireUpdateEveryDays?: number;
      visibility?: 'PUBLIC' | 'PRIVATE';
      sharePolicy?: 'OWNER_ONLY' | 'REQUIRE_PERMISSION' | 'ALLOW_ANYONE';
      notifyOnShare?: boolean;
    }) => {
      setSizeFitSaving(true);
      try {
        const updatedProfile = await SizeFitApi.updateProfile({
          measurements: payload.measurements,
          notes: payload.notes,
          preferredLengthUnit: payload.preferredLengthUnit,
          requireUpdateEveryDays: payload.requireUpdateEveryDays,
        });
        const updatedSettings = await SizeFitApi.updateSettings({
          visibility: payload.visibility,
          sharePolicy: payload.sharePolicy,
          notifyOnShare: payload.notifyOnShare,
          requireUpdateEveryDays: payload.requireUpdateEveryDays,
        });
        const merged = { ...updatedProfile, ...updatedSettings } as SizeFitProfile;

        setSizeFitProfile(merged);
        if (currentUser?.id) {
          queryClient.setQueryData(queryKeys.sizeFit.myProfile(currentUser.id), merged);
        }
        await loadComputedSizeFit(true);
        toast.success('Custom size/fits updated.');
      } catch (err) {
        console.error('Failed to update custom size/fits', err);
        toast.error('Failed to update custom size/fits.');
      } finally {
        setSizeFitSaving(false);
      }
    },
    [currentUser?.id, loadComputedSizeFit, queryClient],
  );

  const handleShareSizeFit = useCallback(
    async (payload: { targetUserIdentifier: string; canReshare?: boolean; note?: string }) => {
      setSizeFitSaving(true);
      try {
        const result = await SizeFitApi.share(payload);
        toast.success(result.requiresApproval ? 'Share request sent for approval.' : 'Size fitting profile shared.');
        await loadSizeFit(true);
      } catch (err) {
        console.error('Failed to share size fitting profile', err);
        toast.error('Unable to process share request.');
      } finally {
        setSizeFitSaving(false);
      }
    },
    [loadSizeFit],
  );

  const handleRespondShareRequest = useCallback(
    async (shareId: string, decision: 'APPROVE' | 'REJECT' | 'REVOKE') => {
      setSizeFitSaving(true);
      try {
        await SizeFitApi.respondToShareRequest(shareId, decision);
        toast.success(
          decision === 'APPROVE'
            ? 'Share request approved.'
            : decision === 'REVOKE'
              ? 'Access revoked.'
              : 'Share request rejected.',
        );
        await loadSizeFit(true);
      } catch (err) {
        console.error('Failed to respond to share request', err);
        toast.error('Unable to update share request.');
      } finally {
        setSizeFitSaving(false);
      }
    },
    [loadSizeFit],
  );

  const handleDisplayChartChange = useCallback(
    async (value: string) => {
      const next = value as CustomOrderChartFamily;
      if (next === displayChartFamily) return;
      setDisplayChartFamily(next);
      setChartSaving(true);
      try {
        const updated = await customOrdersBuyerApi.updateDisplayChartPreference({
          displayChartFamily: next,
          updatedAtMs: Date.now(),
        });
        if (currentUser?.id) {
          queryClient.setQueryData(queryKeys.customOrders.displayChartPreference(currentUser.id), updated);
        }
        toast.success('Display chart updated.');
      } catch (err) {
        console.error('Failed to save display chart preference', err);
        toast.error('Could not save display chart preference.');
      } finally {
        setChartSaving(false);
      }
    },
    [currentUser?.id, displayChartFamily, queryClient],
  );

  useEffect(() => {
    if (!avatarActionsOpen) return;
    const anchor = avatarActionsRef.current;
    if (!anchor) return;

    const decide = () => {
      const rect = anchor.getBoundingClientRect();
      // Menu height plus the 8px offset and a little breathing room.
      const NEEDED_BELOW = 132;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setAvatarMenuDirection(
        spaceBelow < NEEDED_BELOW && spaceAbove > spaceBelow ? 'up' : 'down',
      );
    };

    decide();
    window.addEventListener('resize', decide);
    window.addEventListener('scroll', decide, { passive: true });
    return () => {
      window.removeEventListener('resize', decide);
      window.removeEventListener('scroll', decide);
    };
  }, [avatarActionsOpen]);

  const handleTriggerAvatarUpload = useCallback(() => {
    setAvatarActionsOpen(false);
    avatarInputRef.current?.click();
  }, []);

  const handleAvatarSelected: React.ChangeEventHandler<HTMLInputElement> = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file || !currentUser) return;

      try {
        assertValidUploadFile(file, WEB_UPLOAD_POLICIES.profileImage);
      } catch (uploadError) {
        toast.error(getUploadValidationMessage(uploadError));
        return;
      }

      // Replacing a preview is one of the three deliberate release points.
      releaseAvatarBlob();
      const nextPreviewUrl = URL.createObjectURL(file);
      avatarBlobRef.current = nextPreviewUrl;
      setAvatarSettlingUrl(null);
      setAvatarPreviewUrl(nextPreviewUrl);

      const formData = new FormData();
      formData.append('file', file);

      setAvatarUploading(true);
      try {
        const response = await apiClient.post('/uploads/profile-image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const uploaded = response.data?.data ?? response.data;
        const nextImage = uploaded?.url ?? null;
        const nextImageId = uploaded?.id ?? null;
        const nextProfilePhotoUpdatedAt = new Date().toISOString();
        const nextProfilePhotoViewState =
          nextImage || nextImageId
            ? createUnviewedProfilePhotoViewState(
                currentUser.id,
                nextProfilePhotoUpdatedAt,
              )
            : null;

        setProfile((prev) =>
          prev
            ? {
                ...prev,
                profileImage: nextImage ?? undefined,
                profileImageId: nextImageId,
                profilePhotoUpdatedAt: nextProfilePhotoUpdatedAt,
                profilePhotoViewState: nextProfilePhotoViewState,
                profileImageFile: nextImage
                  ? {
                      id: nextImageId,
                      s3Url: nextImage,
                      fileName: uploaded?.fileName ?? file.name,
                      originalName: uploaded?.originalName ?? file.name,
                      createdAt: uploaded?.createdAt ?? new Date().toISOString(),
                      updatedAt: uploaded?.updatedAt ?? new Date().toISOString(),
                    }
                  : null,
              }
            : prev,
        );

        dispatch(
          setUser({
            ...currentUser,
            profileImage: nextImage,
            profileImageId: nextImageId,
            profilePhotoUpdatedAt: nextProfilePhotoUpdatedAt,
            profileImageFile: nextImage
              ? {
                  id: nextImageId,
                  s3Url: nextImage,
                  fileName: uploaded?.fileName ?? file.name,
                  originalName: uploaded?.originalName ?? file.name,
                  createdAt: uploaded?.createdAt ?? new Date().toISOString(),
                  updatedAt: uploaded?.updatedAt ?? new Date().toISOString(),
                }
              : null,
          }),
        );
        queryClient.setQueryData(queryKeys.user.meProfile(currentUser.id), (current: any) => ({
          ...(current ?? currentUser),
          profileImage: nextImage,
          profileImageId: nextImageId,
          profilePhotoUpdatedAt: nextProfilePhotoUpdatedAt,
          profilePhotoViewState: nextProfilePhotoViewState,
          profileImageFile: nextImage
            ? {
                id: nextImageId,
                s3Url: nextImage,
                fileName: uploaded?.fileName ?? file.name,
                originalName: uploaded?.originalName ?? file.name,
                createdAt: uploaded?.createdAt ?? new Date().toISOString(),
                updatedAt: uploaded?.updatedAt ?? new Date().toISOString(),
              }
            : null,
        }));

        /*
          Stop DRIVING the avatar with the blob, but keep it painted.

          Clearing `avatarPreviewUrl` is what lets `avatar` resolve to the new
          file id; moving the same object URL into `avatarSettlingUrl` keeps it
          on screen underneath while that resolves. It is revoked in
          `handleAvatarSettled` once the remote image has painted.
        */
        setAvatarPreviewUrl(null);
        setAvatarSettlingUrl(nextPreviewUrl);
        toast.success('Profile image updated.');
      } catch (err) {
        console.error('Failed to upload profile image', err);
        setAvatarPreviewUrl(null);
        setAvatarSettlingUrl(null);
        releaseAvatarBlob();
        toast.error('Unable to upload profile image right now.');
      } finally {
        setAvatarUploading(false);
      }
    },
    [currentUser, dispatch, queryClient, releaseAvatarBlob],
  );

  const handleRemoveAvatar = useCallback(async () => {
    if (!currentUser) return;
    setAvatarActionsOpen(false);
    setAvatarUploading(true);
    try {
      await apiClient.delete('/uploads/profile-image');

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              profileImage: undefined,
              profileImageId: null,
              profilePhotoUpdatedAt: null,
              profilePhotoViewState: null,
              profileImageFile: null,
            }
          : prev,
      );

      setAvatarPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });

      dispatch(
        setUser({
          ...currentUser,
          profileImage: null,
          profileImageId: null,
          profilePhotoUpdatedAt: null,
          profileImageFile: null,
        }),
      );
      queryClient.setQueryData(queryKeys.user.meProfile(currentUser.id), (current: any) => ({
        ...(current ?? currentUser),
        profileImage: null,
        profileImageId: null,
        profilePhotoUpdatedAt: null,
        profileImageFile: null,
      }));

      toast.success('Profile image removed.');
    } catch (err) {
      console.error('Failed to remove profile image', err);
      toast.error('Unable to remove profile image right now.');
    } finally {
      setAvatarUploading(false);
    }
  }, [currentUser, dispatch, queryClient]);

  const handleAvatarButtonClick = useCallback(() => {
    if (avatarUploading) return;

    if (!hasAvatarImage) {
      handleTriggerAvatarUpload();
      return;
    }

    setAvatarActionsOpen((current) => !current);
  }, [avatarUploading, handleTriggerAvatarUpload, hasAvatarImage]);

  const handleViewAvatar = useCallback(() => {
    if (!profile || !hasAvatarImage) return;

    setIsAvatarModalOpen(true);

    const currentState = profile.profilePhotoViewState;
    if (!currentUser || !currentState?.canMarkViewed) return;

    void ProfilePhotoViewApi.markViewed(profile.id)
      .then((nextState) => {
        setProfile((current) =>
          current
            ? {
                ...current,
                profilePhotoUpdatedAt: nextState.profilePhotoUpdatedAt,
                profilePhotoViewState: nextState,
              }
            : current,
        );
        const key = isOwner
          ? queryKeys.user.meProfile(profile.id)
          : queryKeys.user.publicProfile(profile.id);
        queryClient.setQueryData(key, (current: any) =>
          current
            ? {
                ...current,
                profilePhotoUpdatedAt: nextState.profilePhotoUpdatedAt,
                profilePhotoViewState: nextState,
              }
            : current,
        );
      })
      .catch((error) => {
        console.error('Failed to mark profile photo viewed', error);
      });
  }, [currentUser, hasAvatarImage, isOwner, profile, queryClient]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1280px] animate-pulse px-4 py-6">
        {/* Avatar + name skeleton */}
        <div className="flex items-center gap-4 mb-6">
          <div className="h-32 w-32 shrink-0 rounded-2xl bg-gray-200 dark:bg-white/10 sm:h-44 sm:w-44" />
          <div className="flex-1 space-y-2.5">
            <div className="h-5 w-2/5 rounded-lg bg-gray-200 dark:bg-white/10" />
            <div className="h-3.5 w-1/4 rounded-lg bg-gray-200 dark:bg-white/10" />
            <div className="h-3 w-1/3 rounded-lg bg-gray-200 dark:bg-white/10" />
          </div>
        </div>
        {/* Actions bar skeleton */}
        <div className="mb-5 flex gap-2">
          {[90, 80, 110, 90, 80].map((w, i) => (
            <div key={i} className="h-9 rounded-full bg-gray-200 dark:bg-white/10" style={{ width: w }} />
          ))}
        </div>
        {/* Size card skeleton */}
        <div className="mb-6 h-28 rounded-2xl bg-gray-200 dark:bg-white/10" />
        {/* Tab bar skeleton */}
        <div className="mb-5 flex gap-6 border-b border-theme pb-px">
          {[70, 80, 70].map((w, i) => (
            <div key={i} className="h-4 rounded bg-gray-200 dark:bg-white/10" style={{ width: w }} />
          ))}
        </div>
        {/* Content skeleton grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] rounded-2xl bg-gray-200 dark:bg-white/10" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="text-5xl" aria-hidden="true">😕</span>
        <h2 className="text-xl font-bold text-theme">Profile Not Found</h2>
        <p className="text-sm text-theme-secondary">
          {error || 'The requested profile could not be found.'}
        </p>
      </div>
    );
  }

  const profileUrl = buildProfileUrl({ id: profile.id, username: profile.username });
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() || profile.username;
  const avatar = resolveProfileImageSource({
    profileImage: avatarPreviewUrl ?? profile.profileImage ?? (isOwner ? currentUser?.profileImage : null),
    profileImageId: avatarPreviewUrl
      ? null
      : (profile.profileImageId ?? (isOwner ? currentUser?.profileImageId : null) ?? null),
    profileImageFile: avatarPreviewUrl
      ? null
      : (profile.profileImageFile ?? (isOwner ? currentUser?.profileImageFile : null) ?? null),
  });
  const avatarFallback = getAvatarFallback(fullName, profile.username);
  const avatarRingClass =
    hasAvatarImage && profile.profilePhotoViewState?.profilePhotoUpdatedAt
      ? profile.profilePhotoViewState.hasUnviewedUpdate
        ? 'profile-photo-ring-new'
        : 'profile-photo-ring-viewed'
      : 'profile-photo-frame-neutral';
  const alphaFitLabel = describeAlphaFit(computedAlphaSize);
  // Quick-access fittings (parity with the native profile): every saved
  // measurement as a compact chip. Keys carry MEN_/WOMEN_ namespacing that must
  // never surface as a label — the brand already chose who the design is for.
  const formatMeasurementLabel = (key: string): string =>
    key
      .replace(/^(MEN|WOMEN|MENS|WOMENS|UNISEX)_/i, '')
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (ch) => ch.toUpperCase());
  const savedMeasurementEntries = dedupeMeasurementEntries(
    Object.entries(sizeFitProfile?.measurements ?? {}).filter(
      ([, value]) => String(value ?? '').trim().length > 0,
    ),
  );
  const measurementUnitLabel = (sizeFitProfile?.preferredLengthUnit ?? 'CM').toLowerCase();
  const profileActions: ProfileAction[] = [
    {
      key: 'edit',
      icon: '✏️',
      label: 'Edit',
      onClick: () => setIsQuickEditOpen(true),
      hidden: true,
    },
    {
      key: 'share',
      icon: '🔗',
      label: 'Share',
      onClick: handleShareProfile,
      hidden: true,
    },
    {
      key: 'fits',
      icon: sizeFitProfile?.isUpdateDue ? '⚠️' : '📐',
      label: sizeFitProfile?.isUpdateDue ? 'Update Fittings' : 'My Fits',
      onClick: () => setIsSizeFitOpen(true),
      pulse: sizeFitProfile?.isUpdateDue,
    },
    {
      key: 'quick-share',
      icon: '↗️',
      label: 'Quick Share',
      onClick: () => setIsQuickShareOpen(true),
    },
    {
      key: 'qr',
      icon: '🗳️',
      label: 'QR Code',
      onClick: () => setIsQrOpen(true),
    },
  ];

  const TAB_ICONS: Record<string, string> = { Saved: '🗂️', Patches: '🪡', Orders: '📦' };

  return (
    <div className="relative min-h-screen">
      <div className="mx-auto w-full max-w-[1280px] px-3 pb-28 pt-4 sm:px-5 sm:pt-6 xl:pb-10">

        {/* ── PROFILE HEADER ── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="mb-5"
        >
          {/* Top row: avatar + identity + inline size widget */}
          <div className="flex items-start gap-4 sm:gap-6">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div
                aria-busy={avatarUploading || undefined}
                className={`relative h-32 w-32 overflow-hidden rounded-xl border-2 transition-colors duration-300 sm:h-44 sm:w-44 ${avatarRingClass}`}
              >
                <button
                  type="button"
                  className="relative h-full w-full overflow-hidden rounded-[0.65rem] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--menu-focus-ring)] disabled:cursor-default"
                  onClick={handleViewAvatar}
                  disabled={!hasAvatarImage}
                  aria-label="View profile photo"
                >
                {/*
                  The outgoing photo, painted underneath the incoming one.

                  Only present between "upload succeeded" and "the stored image
                  has painted". `ImageWithFallback` fades in over the top of it
                  and then calls `onLoaded`, which revokes this. Without it the
                  frame is empty for the length of a signed-URL round trip.
                */}
                {avatarSettlingUrl ? (
                  <MediaRenderer
                    kind="image"
                    src={avatarSettlingUrl}
                    alt=""
                    fit="cover"
                    loading="eager"
                    className="absolute inset-0 h-full w-full"
                    mediaClassName="h-full w-full rounded-[inherit] object-cover"
                    maxHeightClassName="max-h-full"
                    maxWidthClassName="max-w-full"
                  />
                ) : null}
                <ImageWithFallback
                  src={avatar.src}
                  fileId={avatar.fileId}
                  alt={fullName}
                  fit="cover"
                  rounded="xl"
                  fallbackName={avatarFallback}
                  onLoaded={handleAvatarSettled}
                  containerClassName="relative z-10 h-full w-full"
                  className={`h-full w-full rounded-[inherit] object-cover transition duration-500 ${
                    avatarUploading ? 'scale-105 blur-[3px] grayscale-[0.6]' : ''
                  }`}
                  maxHeightClassName="max-h-full"
                />
                </button>
                {/*
                  Skeleton, not a caption.

                  This was a black scrim with the word "Uploading…" in a pill,
                  and a SECOND pill saying "Uploading photo…" sat beside the
                  name — two labels for one event, and the outer one was in
                  document flow, so it shoved the name block down on appear and
                  back up on finish. That is the shake. What is left says the
                  same thing without words: the subject blurs and desaturates
                  (above), a scrim pulses, and a bar sweeps the bottom edge.
                  Screen readers get the announcement they need via role=status.
                */}
                {avatarUploading && (
                  <div
                    className="pointer-events-none absolute inset-0 z-20 rounded-[inherit]"
                    aria-hidden="true"
                  >
                    <div className="absolute inset-0 animate-pulse rounded-[inherit] bg-slate-900/25" />
                    <div className="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-white/30">
                      <div className="h-full w-1/2 animate-pulse rounded-full bg-white/90" />
                    </div>
                  </div>
                )}
                {avatarUploading ? (
                  <span role="status" className="sr-only">
                    Uploading profile photo
                  </span>
                ) : null}
              </div>
              {/* Avatar action button */}
              {isOwner ? (
                <div ref={avatarActionsRef} className="absolute -bottom-1.5 -right-1.5 z-20">
                  <button
                    type="button"
                    onClick={handleAvatarButtonClick}
                    disabled={avatarUploading}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-white/80 bg-purple-600 text-sm shadow-sm transition hover:bg-purple-700 active:scale-95 disabled:opacity-60 dark:border-zinc-900/80"
                    title={hasAvatarImage ? 'Profile photo actions' : 'Upload profile photo'}
                    aria-label={hasAvatarImage ? 'Profile photo actions' : 'Upload profile photo'}
                    aria-expanded={avatarActionsOpen}
                    aria-haspopup={hasAvatarImage}
                  >
                    📷
                  </button>

                  <AnimatePresence>
                    {avatarActionsOpen ? (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        transition={{ duration: 0.16 }}
                        className={`glass-menu absolute right-0 w-44 overflow-hidden p-1 ${
                          avatarMenuDirection === 'up'
                            ? 'bottom-full mb-2'
                            : 'top-full mt-2'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={handleTriggerAvatarUpload}
                          className="menu-item-interactive flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium"
                        >
                          <span aria-hidden="true">📷</span>
                          Change photo
                        </button>
                        {hasAvatarImage ? (
                          <button
                            type="button"
                            onClick={() => void handleRemoveAvatar()}
                            className="menu-item-danger mt-1 flex w-full items-center gap-2 rounded-xl border-t border-[color:var(--border-default)] px-3 py-2 text-left text-sm font-medium"
                          >
                            <span aria-hidden="true">🗑️</span>
                            Remove photo
                          </button>
                        ) : null}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-white/90 text-sm shadow-sm dark:border-zinc-900 dark:bg-zinc-800">
                  {profile.profileVisibility === 'LOCKED' ? '🔒' : '🌐'}
                </div>
              )}
            </div>

            {/* Identity */}
            <div className="min-w-0 flex-1 pt-0.5">
              <h1 className="truncate text-xl font-black tracking-tight text-theme sm:text-3xl">
                {fullName}
              </h1>
              {profile.username ? (
                <p className="mt-0.5 truncate text-sm text-theme-secondary">
                  @{profile.username}
                </p>
              ) : null}
              {profile.location ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-theme-secondary sm:text-xs">
                  <span className="flex items-center gap-0.5">
                    <span aria-hidden="true">📍</span> {profile.location}
                  </span>
                </div>
              ) : null}

              {/*
                The upload pill that lived here has been removed. Progress
                belongs on the thing being changed — it is now the skeleton over
                the avatar itself — and a block that appears and disappears in
                this column reflows the name and handle every time.
              */}
            </div>

            {/* ── Compact inline size widget (owner only) ── */}
            {isOwner ? (
              <div className="hidden shrink-0 flex-col items-end gap-2 sm:flex">
                {/* Chart family tabs */}
                <div className="flex gap-0.5 rounded-lg bg-indigo-50 p-0.5 dark:bg-indigo-950/40">
                  {DISPLAY_CHART_OPTIONS.slice(0, 4).map((option) => {
                    const active = displayChartFamily === option.value;
                    const shortLabel = option.label
                      .replace('Nigeria', 'NG')
                      .replace('UK-Nigeria Hybrid', 'UK-NG')
                      .replace('US-Nigeria Hybrid', 'US-NG')
                      .replace('Asia', 'Asia');
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => void handleDisplayChartChange(option.value)}
                        disabled={chartSaving}
                        aria-pressed={active}
                        className={`rounded-md px-2 py-1 text-[10px] font-bold transition ${
                          active
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-indigo-500 hover:bg-indigo-100 dark:text-indigo-300 dark:hover:bg-indigo-900/40'
                        }`}
                      >
                        {shortLabel}
                      </button>
                    );
                  })}
                </div>
                {/*
                  Size number.

                  Changing chart used to blank this to "…" and then to the new
                  value: two layout changes per tap, in a block the profile
                  name and handle sit beside, so the whole header stepped
                  sideways twice. The number now HOLDS its last value while the
                  next one is fetched and only dims — one change, at the moment
                  the answer actually arrives.

                  `min-h` on the message slot reserves the tallest thing that
                  can appear under the number, so a warning arriving does not
                  push the block either.
                */}
                <div className="text-right">
                  <div
                    className={`text-3xl font-black leading-none text-indigo-900 transition-opacity dark:text-indigo-100 ${
                      chartLoading ? 'opacity-50' : 'opacity-100'
                    }`}
                    aria-busy={chartLoading}
                    aria-live="polite"
                  >
                    {computedSize || (chartLoading ? '…' : '—')}
                  </div>
                  {alphaFitLabel ? (
                    <div className="mt-0.5 text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                      {alphaFitLabel}
                    </div>
                  ) : null}
                  <div className="ml-auto max-w-[210px]">
                    {!chartLoading && !computedSize && computedMissingBaseline.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setIsSizeFitOpen(true)}
                        className="mt-1 max-w-[180px] text-right text-[11px] font-semibold leading-snug text-amber-600 transition hover:text-amber-700 dark:text-amber-300 dark:hover:text-amber-200"
                      >
                        Add {computedMissingBaseline.map((key) => formatMeasurementLabel(key)).join(' · ')} to see your size →
                      </button>
                    ) : !chartLoading && !computedSize && computedWarning ? (
                      <p className="mt-1 text-right text-[11px] leading-snug text-amber-600 dark:text-amber-400">
                        {computedWarning}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* ── MY FITTINGS carousel: every saved fitting from baggings, moving
                two-by-two at the bottom of the fittings box ── */}
          {isOwner && savedMeasurementEntries.length > 0 ? (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setIsSizeFitOpen(true)}
                className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500 transition hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-300"
              >
                📏 My fittings · {savedMeasurementEntries.length}
              </button>
              {/*
                ONE row, not two.

                The fittings used to be dealt into two marquee rows by parity
                (`index % 2`), which stacked them and made the block twice as
                tall for no gain — a reader scanning for "Waist" had to check
                two moving lines instead of one. A single marquee already
                scrolls, so it holds any number of fittings in one line.
              */}
              <FittingsMarqueeRow
                row={savedMeasurementEntries}
                unitLabel={measurementUnitLabel}
                formatLabel={formatMeasurementLabel}
                onSelect={() => setIsSizeFitOpen(true)}
              />
            </div>
          ) : null}

          {/* ── ACTION BAR ── */}
          {isOwner ? (
            <div className="mt-4">
              <ProfileActionsBar actions={profileActions} />
            </div>
          ) : null}

          {/* ── SIZE/FIT strip (mobile: compact inline below actions) ── */}
          {isOwner ? (
            <div className="mt-3 sm:hidden">
              <div className="flex items-center gap-3 rounded-2xl border border-indigo-200/60 bg-indigo-50/70 px-4 py-2.5 dark:border-indigo-500/20 dark:bg-indigo-950/30">
                {/* Chart tabs */}
                <div className="flex gap-0.5 rounded-md bg-white/60 p-0.5 dark:bg-white/10">
                  {DISPLAY_CHART_OPTIONS.slice(0, 4).map((option) => {
                    const active = displayChartFamily === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => void handleDisplayChartChange(option.value)}
                        disabled={chartSaving}
                        aria-pressed={active}
                        className={`rounded px-1.5 py-0.5 text-[9px] font-bold transition ${
                          active ? 'bg-indigo-600 text-white' : 'text-indigo-500 dark:text-indigo-300'
                        }`}
                      >
                        {option.label.replace('Nigeria', 'NG').replace('UK-Nigeria Hybrid', 'UK-NG').replace('US-Nigeria Hybrid', 'US-NG')}
                      </button>
                    );
                  })}
                </div>
                {/* Size number — holds its last value while the next chart
                    resolves, so a tab tap does not reflow this strip. */}
                <div
                  className={`text-2xl font-black leading-none text-indigo-900 transition-opacity dark:text-indigo-100 ${
                    chartLoading ? 'opacity-50' : 'opacity-100'
                  }`}
                  aria-busy={chartLoading}
                  aria-live="polite"
                >
                  {computedSize || (chartLoading ? '…' : '—')}
                </div>
                {alphaFitLabel ? (
                  <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                    {alphaFitLabel}
                  </div>
                ) : !chartLoading && !computedSize && computedMissingBaseline.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setIsSizeFitOpen(true)}
                    className="min-w-0 flex-1 text-left text-[10px] font-semibold leading-snug text-amber-600 dark:text-amber-300"
                  >
                    Add {computedMissingBaseline.map((key) => formatMeasurementLabel(key)).join(' · ')} →
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

        </motion.section>

        {/* ── TAB BAR ── */}
        <div className="sticky top-16 z-10 -mx-3 mb-4 border-b border-gray-200/70 bg-white/80 px-3 backdrop-blur-md dark:border-white/10 dark:bg-[#0a0812]/80 sm:-mx-5 sm:px-5">
          <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide">
            {availableTabs.map((key) => {
              const active = activeTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`relative flex min-w-0 flex-shrink-0 items-center gap-2 px-4 py-3.5 text-sm font-semibold transition-colors sm:px-6 ${
                    active
                      ? 'text-fuchsia-600 dark:text-fuchsia-400'
                      : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  <span className="text-base leading-none">{TAB_ICONS[key]}</span>
                  <span className="whitespace-nowrap">{key}</span>
                  {active && (
                    <motion.div
                      layoutId="profile-tab-indicator"
                      className="absolute inset-x-0 bottom-0 h-0.5 rounded-t-full bg-fuchsia-500"
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── TAB CONTENT ── */}
        <div className={activeTab === 'Orders' ? '' : 'lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6 xl:grid-cols-[minmax(0,1fr)_360px]'}>
          {/* Main column */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              {activeTab === 'Orders' && isOwner ? (
                <OrdersPanel
                  mode="full"
                  initialSelection={ordersSelection}
                  onSelectionHandled={() => setOrdersSelection(null)}
                />
              ) : activeTab === 'Saved' ? (
                isOwner
                  ? <SavedTab isOwner={isOwner} />
                  : <PatchesTab isOwner={isOwner} profileVisibility={profile.profileVisibility} />
              ) : (
                <PatchesTab isOwner={isOwner} profileVisibility={profile.profileVisibility} />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Desktop sidebar column: orders summary */}
          {isOwner && activeTab !== 'Orders' ? (
            <div className="hidden lg:flex lg:flex-col lg:gap-5">
              <OrdersPanel
                onViewAll={(selection) => {
                  if (selection) {
                    navigate(`/profile?tab=orders&kind=${selection.kind}&orderId=${selection.id}`);
                  } else {
                    navigate('/profile?tab=orders');
                  }
                  setOrdersSelection(selection ?? null);
                  setActiveTab('Orders');
                }}
              />
            </div>
          ) : null}
        </div>

        {/* Tablet-only: orders summary below content on non-orders tabs.
            Phones (<md) intentionally do NOT get this duplicate — the Orders
            tab itself is the single home for all orders on mobile browsers. */}
        {isOwner && activeTab !== 'Orders' ? (
          <div className="mt-5 hidden md:block lg:hidden">
            <OrdersPanel
              onViewAll={(selection) => {
                if (selection) {
                  navigate(`/profile?tab=orders&kind=${selection.kind}&orderId=${selection.id}`);
                } else {
                  navigate('/profile?tab=orders');
                }
                setOrdersSelection(selection ?? null);
                setActiveTab('Orders');
              }}
            />
          </div>
        ) : null}
      </div>

      {/* ── MODALS ── */}
      <EndUserQuickEditModal
        open={isQuickEditOpen}
        saving={savingQuickEdit}
        initialValues={{
          firstName: profile.firstName,
          lastName: profile.lastName,
          address: profile.address ?? '',
        }}
        onClose={() => setIsQuickEditOpen(false)}
        onSave={handleQuickProfileSave}
      />

      <EndUserSizeFitModal
        open={isSizeFitOpen}
        loading={sizeFitLoading}
        saving={sizeFitSaving}
        profile={sizeFitProfile}
        onClose={() => setIsSizeFitOpen(false)}
        onSave={handleSaveSizeFit}
      />

      <EndUserSizeFitQuickShareModal
        open={isQuickShareOpen}
        saving={sizeFitSaving}
        sharePolicy={sizeFitProfile?.sharePolicy ?? 'REQUIRE_PERMISSION'}
        shares={sizeFitShares}
        onClose={() => setIsQuickShareOpen(false)}
        onShare={handleShareSizeFit}
        onRespond={handleRespondShareRequest}
      />

      <EndUserProfileQrModal
        open={isQrOpen}
        onClose={() => setIsQrOpen(false)}
        profileUrl={profileUrl}
        logoUrl={profile.profileImage}
        username={profile.username}
      />

      <ProfileImageModal
        open={isAvatarModalOpen && Boolean(avatar.src ?? avatar.fileId)}
        src={avatar.src}
        fileId={avatar.fileId}
        alt={fullName}
        onClose={() => setIsAvatarModalOpen(false)}
      />


      {isOwner ? (
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarSelected}
        />
      ) : null}
    </div>
  );
};
