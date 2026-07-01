import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { AlertTriangle, CalendarClock, ChevronRight, Lock, MapPin, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/api/httpClient';
import type { RootState } from '@/store';
import EmptyState from '@/components/EmptyState';
import ImageWithFallback from '@/components/ImageWithFallback';
import { getAvatarFallback, resolveProfileImageSource } from '@/utils/profileImage';
import useCachedResource from '@/hooks/useCachedResource';
import { queryClient } from '@/query/queryClient';

type ViewMode = 'grid' | 'list' | 'compact';

interface PatchedBrand {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profileImage?: string;
  profileImageId?: string | null;
  profileImageFile?: { id?: string | null; s3Url?: string | null } | null;
  bannerImage?: string;
  brandName: string;
  brandTitle?: string | null;
  location?: string | null;
  description?: string | null;
  brandLogo?: string;
  patchedAt?: string;
}

interface PatchesTabProps {
  isOwner: boolean;
  profileVisibility: 'UNLOCKED' | 'LOCKED';
}

export const PatchesTab: React.FC<PatchesTabProps> = ({ isOwner, profileVisibility }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [unpatchingBrandId, setUnpatchingBrandId] = useState<string | null>(null);
  const currentUserId = useSelector((state: RootState) => state.user.profile?.id);
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const profileId = isOwner ? currentUserId : id;
  const patchesEnabled = (isOwner || profileVisibility !== 'LOCKED') && Boolean(profileId);
  const patchesQueryKey = ['patches', profileId ?? null, isOwner ? 'owner' : 'public'] as const;

  // Cached fetch: patched brands paint instantly on revisit and revalidate silently.
  const {
    data: patchedBrands = [],
    loading,
    error: fetchError,
  } = useCachedResource<PatchedBrand[]>({
    queryKey: patchesQueryKey,
    queryFn: async ({ signal }) => {
      if (!profileId) throw new Error('Profile ID not found');
      const endpoint = isOwner
        ? `/users/${profileId}/patches`
        : `/users/${profileId}/patches/public`;
      const response = await apiClient.get(endpoint, { signal });
      const payload = response.data?.data ?? response.data;
      const rows = payload?.items ?? payload;
      return Array.isArray(rows) ? (rows as PatchedBrand[]) : [];
    },
    enabled: patchesEnabled,
  });
  const error = fetchError ? 'Failed to load patched brands' : null;

  const sortedPatchedBrands = useMemo(() => {
    return [...patchedBrands].sort((a, b) => {
      const left = a.patchedAt ? new Date(a.patchedAt).getTime() : 0;
      const right = b.patchedAt ? new Date(b.patchedAt).getTime() : 0;
      return right - left;
    });
  }, [patchedBrands]);

  const navigateToBrandCatalog = (brandId: string) => {
    navigate(`/profile/${brandId}?tab=Content`);
  };

  const handleUnpatchBrand = async (brandId: string) => {
    try {
      setUnpatchingBrandId(brandId);
      await apiClient.delete(`/brands/${brandId}/patches`);
      queryClient.setQueryData<PatchedBrand[]>(patchesQueryKey, (prev) =>
        (prev ?? []).filter((b) => b.id !== brandId),
      );
      toast.success('Brand unpatched successfully.');
    } catch (err) {
      console.error('Error unpatching brand:', err);
      toast.error('Failed to unpatch brand.');
    } finally {
      setUnpatchingBrandId(null);
    }
  };

  if (!isOwner && profileVisibility === 'LOCKED') {
    return (
      <div className="py-12">
        <EmptyState
          title="Private Profile"
          description="This user's patches list is private and not visible to others."
          icon={<Lock className="h-8 w-8 text-rose-500" />}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, idx) => (
          <div key={idx} className="rounded-2xl border border-white/20 dark:border-white/10 bg-white/55 dark:bg-white/5 backdrop-blur p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-gray-200 dark:bg-gray-700 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12">
        <EmptyState
          title="Error Loading Patches"
          description={error}
          icon={<AlertTriangle className="h-8 w-8 text-amber-500" />}
        />
      </div>
    );
  }

  if (patchedBrands.length === 0) {
    return (
      <div className="py-12">
        <EmptyState
          title="No Patches Yet"
          description="When you patch brands, they will appear here."
          icon={<Tag className="h-8 w-8 text-indigo-500" />}
        />
      </div>
    );
  }

  /* --- Grid card (default) --- */
  const renderGridCard = (brand: PatchedBrand, avatar: ReturnType<typeof resolveProfileImageSource>, fallback: string) => (
    <div
      key={brand.id}
      className="group relative rounded-2xl border border-purple-200/40 dark:border-purple-500/15 bg-gradient-to-br from-white/80 via-white/60 to-purple-50/40 dark:from-white/[0.06] dark:via-white/[0.03] dark:to-purple-900/10 backdrop-blur-md p-4 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10 hover:border-purple-400/50 dark:hover:border-purple-400/30 hover:-translate-y-0.5 cursor-pointer overflow-hidden"
      onClick={() => navigateToBrandCatalog(brand.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigateToBrandCatalog(brand.id); } }}
    >
      {/* Subtle gradient shine on hover */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-purple-500/0 via-purple-500/0 to-purple-500/0 group-hover:from-purple-500/[0.03] group-hover:via-transparent group-hover:to-pink-500/[0.03] transition-all duration-500 pointer-events-none" />

      <div className="relative flex items-start gap-3.5">
        {/* Square profile image */}
        <div className="h-14 w-14 shrink-0">
          <ImageWithFallback
            src={avatar.src}
            fileId={avatar.fileId}
            alt={brand.brandName}
            fit="cover"
            rounded="lg"
            fallbackName={fallback}
            containerClassName="h-14 w-14 rounded-xl overflow-hidden ring-2 ring-purple-200/50 dark:ring-purple-500/20 shadow-sm"
            className="h-14 w-14 object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-bold text-gray-900 dark:text-white truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
            {brand.brandName}
          </p>
          <p className="text-sm text-purple-600/70 dark:text-purple-400/60 font-medium truncate">
            @{brand.username}
          </p>
          {brand.brandTitle && (
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-1 italic">{brand.brandTitle}</p>
          )}
        </div>

        <ChevronRight size={16} className="shrink-0 mt-1 text-purple-300 dark:text-purple-500/40 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
      </div>

      {/* Meta row */}
      <div className="relative mt-3 pt-3 border-t border-purple-100/50 dark:border-purple-500/10 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex flex-wrap items-center gap-3">
          {brand.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3 text-purple-400" />
              <span className="line-clamp-1">{brand.location}</span>
            </span>
          )}
          {brand.patchedAt && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3 w-3 text-purple-400" />
              <span>Patched {new Date(brand.patchedAt).toLocaleDateString()}</span>
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm shadow-purple-500/20 hover:shadow-md hover:shadow-purple-500/30 hover:brightness-110 transition-all"
            onClick={() => navigateToBrandCatalog(brand.id)}
          >
            Catalog
          </button>
          {isOwner && (
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200/60 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-500/10 dark:hover:text-red-400 dark:hover:border-red-500/20 transition-all"
              onClick={() => handleUnpatchBrand(brand.id)}
              disabled={unpatchingBrandId === brand.id}
            >
              {unpatchingBrandId === brand.id ? 'Removing…' : 'Unpatch'}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  /* --- List row --- */
  const renderListRow = (brand: PatchedBrand, avatar: ReturnType<typeof resolveProfileImageSource>, fallback: string) => (
    <div
      key={brand.id}
      className="group relative flex items-center gap-4 rounded-2xl border border-purple-200/40 dark:border-purple-500/15 bg-gradient-to-r from-white/80 to-purple-50/30 dark:from-white/[0.06] dark:to-purple-900/10 backdrop-blur-md px-4 py-3 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10 hover:border-purple-400/50 dark:hover:border-purple-400/30 hover:-translate-y-0.5 cursor-pointer overflow-hidden"
      onClick={() => navigateToBrandCatalog(brand.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigateToBrandCatalog(brand.id); } }}
    >
      <div className="h-12 w-12 shrink-0">
        <ImageWithFallback
          src={avatar.src}
          fileId={avatar.fileId}
          alt={brand.brandName}
          fit="cover"
          rounded="lg"
          fallbackName={fallback}
          containerClassName="h-12 w-12 rounded-xl overflow-hidden ring-2 ring-purple-200/50 dark:ring-purple-500/20 shadow-sm"
          className="h-12 w-12 object-cover"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="font-bold text-gray-900 dark:text-white truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
            {brand.brandName}
          </p>
          <span className="text-xs text-purple-600/70 dark:text-purple-400/60 font-medium truncate shrink-0">@{brand.username}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          {brand.location && (
            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3 text-purple-400" />{brand.location}</span>
          )}
          {brand.patchedAt && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3 w-3 text-purple-400" />
              Patched {new Date(brand.patchedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm shadow-purple-500/20 hover:shadow-md hover:shadow-purple-500/30 hover:brightness-110 transition-all"
          onClick={() => navigateToBrandCatalog(brand.id)}
        >
          Catalog
        </button>
        {isOwner && (
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200/60 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-500/10 dark:hover:text-red-400 dark:hover:border-red-500/20 transition-all"
            onClick={() => handleUnpatchBrand(brand.id)}
            disabled={unpatchingBrandId === brand.id}
          >
            {unpatchingBrandId === brand.id ? 'Removing…' : 'Unpatch'}
          </button>
        )}
      </div>

      <ChevronRight size={16} className="shrink-0 text-purple-300 dark:text-purple-500/40 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
    </div>
  );

  /* --- Compact pill --- */
  const renderCompactPill = (brand: PatchedBrand, avatar: ReturnType<typeof resolveProfileImageSource>, fallback: string) => (
    <div
      key={brand.id}
      className="group inline-flex items-center gap-2.5 rounded-xl border border-purple-200/40 dark:border-purple-500/15 bg-gradient-to-r from-white/70 to-purple-50/30 dark:from-white/[0.06] dark:to-purple-900/10 backdrop-blur-md px-3 py-2 transition-all duration-300 hover:shadow-md hover:shadow-purple-500/10 hover:border-purple-400/50 dark:hover:border-purple-400/30 cursor-pointer"
      onClick={() => navigateToBrandCatalog(brand.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigateToBrandCatalog(brand.id); } }}
    >
      <div className="h-8 w-8 shrink-0">
        <ImageWithFallback
          src={avatar.src}
          fileId={avatar.fileId}
          alt={brand.brandName}
          fit="cover"
          rounded="lg"
          fallbackName={fallback}
          containerClassName="h-8 w-8 rounded-lg overflow-hidden ring-1 ring-purple-200/50 dark:ring-purple-500/20"
          className="h-8 w-8 object-cover"
        />
      </div>
      <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
        {brand.brandName}
      </span>
      {isOwner && (
        <button
          type="button"
          className="ml-auto flex items-center justify-center h-5 w-5 rounded-full text-[11px] text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 transition-all"
          onClick={(e) => { e.stopPropagation(); handleUnpatchBrand(brand.id); }}
          disabled={unpatchingBrandId === brand.id}
        >
          {unpatchingBrandId === brand.id ? '…' : '×'}
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-[color:var(--text-secondary)]">
          {sortedPatchedBrands.length} active patch{sortedPatchedBrands.length === 1 ? '' : 'es'}
        </div>
        <div className="inline-flex items-center rounded-full border border-purple-200/40 dark:border-purple-500/15 bg-white/60 dark:bg-white/5 backdrop-blur-md p-1 shadow-sm">
          {(['grid', 'list', 'compact'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                viewMode === mode
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm shadow-purple-500/20'
                  : 'text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-500/10'
              }`}
            >
              {mode === 'grid' ? 'Cards' : mode === 'list' ? 'List' : 'Compact'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid / List / Compact renders */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {sortedPatchedBrands.map((brand) => {
            const avatar = resolveProfileImageSource({ profileImage: brand.profileImage, profileImageId: brand.profileImageId, profileImageFile: brand.profileImageFile, brandLogo: brand.brandLogo });
            return renderGridCard(brand, avatar, getAvatarFallback(brand.brandName, brand.username));
          })}
        </div>
      )}

      {viewMode === 'list' && (
        <div className="space-y-2">
          {sortedPatchedBrands.map((brand) => {
            const avatar = resolveProfileImageSource({ profileImage: brand.profileImage, profileImageId: brand.profileImageId, profileImageFile: brand.profileImageFile, brandLogo: brand.brandLogo });
            return renderListRow(brand, avatar, getAvatarFallback(brand.brandName, brand.username));
          })}
        </div>
      )}

      {viewMode === 'compact' && (
        <div className="flex flex-wrap gap-2">
          {sortedPatchedBrands.map((brand) => {
            const avatar = resolveProfileImageSource({ profileImage: brand.profileImage, profileImageId: brand.profileImageId, profileImageFile: brand.profileImageFile, brandLogo: brand.brandLogo });
            return renderCompactPill(brand, avatar, getAvatarFallback(brand.brandName, brand.username));
          })}
        </div>
      )}
    </div>
  );
};
