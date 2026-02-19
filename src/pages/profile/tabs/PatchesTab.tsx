import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { AlertTriangle, CalendarClock, Lock, MapPin, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/api/httpClient';
import type { RootState } from '@/store';
import EmptyState from '@/components/EmptyState';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ImageWithFallback from '@/components/ImageWithFallback';
import { getAvatarFallback, resolveProfileImageSource } from '@/utils/profileImage';

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
  const patchDetailsEmoji = String.fromCodePoint(0x1f9f7);
  const [patchedBrands, setPatchedBrands] = useState<PatchedBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [unpatchingBrandId, setUnpatchingBrandId] = useState<string | null>(null);
  const currentUserId = useSelector((state: RootState) => state.user.profile?.id);
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPatchedBrands = async () => {
      if (!isOwner && profileVisibility === 'LOCKED') {
        setPatchedBrands([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const profileId = isOwner ? currentUserId : id;
        if (!profileId) {
          throw new Error('Profile ID not found');
        }

        const endpoint = isOwner
          ? `/users/${profileId}/patches`
          : `/users/${profileId}/patches/public`;
        const response = await apiClient.get(endpoint);
        const payload = response.data?.data ?? response.data;
        const rows = payload?.items ?? payload;
        setPatchedBrands(Array.isArray(rows) ? rows : []);
      } catch (err) {
        setError('Failed to load patched brands');
        console.error('Error fetching patched brands:', err);
      } finally {
        setLoading(false);
      }
    };

    void fetchPatchedBrands();
  }, [isOwner, profileVisibility, currentUserId, id]);

  const sortedPatchedBrands = useMemo(() => {
    return [...patchedBrands].sort((a, b) => {
      const left = a.patchedAt ? new Date(a.patchedAt).getTime() : 0;
      const right = b.patchedAt ? new Date(b.patchedAt).getTime() : 0;
      return right - left;
    });
  }, [patchedBrands]);

  const navigateToBrandCatalog = (brandId: string) => {
    navigate(`/profile/${brandId}?tab=Store`);
  };

  const handleUnpatchBrand = async (brandId: string) => {
    try {
      setUnpatchingBrandId(brandId);
      await apiClient.delete(`/brands/${brandId}/patches`);
      setPatchedBrands((prev) => prev.filter((b) => b.id !== brandId));
      toast.success('Brand unpatched successfully.');
    } catch (err) {
      console.error('Error unpatching brand:', err);
      toast.error('Failed to unpatch brand.');
    } finally {
      setUnpatchingBrandId(null);
    }
  };

  const itemLayoutClass =
    viewMode === 'grid'
      ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4'
      : 'space-y-3';

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
          <div key={idx} className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 animate-pulse">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full mr-3" />
              <div className="flex-1">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2 w-3/4" />
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-gray-600 dark:text-gray-300">
          {sortedPatchedBrands.length} active patch{sortedPatchedBrands.length === 1 ? '' : 'es'}
        </div>
        <div className="inline-flex items-center rounded-full border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/70 p-1">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              viewMode === 'grid'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            Cards
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              viewMode === 'list'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => setViewMode('compact')}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              viewMode === 'compact'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            Compact
          </button>
        </div>
      </div>

      <div className={itemLayoutClass}>
        {sortedPatchedBrands.map((brand) => {
          const avatar = resolveProfileImageSource({
            profileImage: brand.profileImage,
            profileImageId: brand.profileImageId,
            profileImageFile: brand.profileImageFile,
            brandLogo: brand.brandLogo,
          });
          const fallback = getAvatarFallback(brand.brandName, brand.username);

          return (
            <Card
              key={brand.id}
              className={`p-4 ${viewMode === 'compact' ? 'py-3' : ''}`}
            >
              <div className={`flex ${viewMode === 'list' ? 'items-start' : 'items-center'} gap-3`}>
                <div className="h-12 w-12 shrink-0">
                  <ImageWithFallback
                    src={avatar.src}
                    fileId={avatar.fileId}
                    alt={brand.brandName}
                    fit="cover"
                    rounded="full"
                    fallbackName={fallback}
                    containerClassName="h-12 w-12 rounded-full overflow-hidden ring-2 ring-white dark:ring-gray-800"
                    className="h-12 w-12 object-cover"
                  />
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <button
                    type="button"
                    onClick={() => navigateToBrandCatalog(brand.id)}
                    className="max-w-full truncate text-left font-semibold text-gray-900 hover:text-indigo-600 dark:text-white dark:hover:text-indigo-300"
                    title={`Open ${brand.brandName} catalog`}
                  >
                    {brand.brandName}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateToBrandCatalog(brand.id)}
                    className="max-w-full truncate text-left text-sm text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-300"
                    title={`Open @${brand.username} catalog`}
                  >
                    @{brand.username}
                  </button>
                  {brand.brandTitle ? (
                    <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-1">{brand.brandTitle}</p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    {brand.location ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="line-clamp-1">{brand.location}</span>
                      </span>
                    ) : null}
                    {brand.patchedAt ? (
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5" />
                        <span>Patched {new Date(brand.patchedAt).toLocaleDateString()}</span>
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  <div className="relative group">
                    <span
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 text-base dark:border-indigo-800 dark:bg-indigo-900/30"
                      role="img"
                      aria-label="Patch details"
                    >
                      {patchDetailsEmoji}
                    </span>
                    <span className="pointer-events-none absolute right-0 top-10 z-20 min-w-[180px] rounded-xl bg-gray-900 px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-gray-100 dark:text-gray-900">
                      {brand.description?.trim() || 'Patched brand connection active.'}
                    </span>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigateToBrandCatalog(brand.id)}
                  >
                    Catalog
                  </Button>
                  {isOwner ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleUnpatchBrand(brand.id)}
                      disabled={unpatchingBrandId === brand.id}
                    >
                      {unpatchingBrandId === brand.id ? 'Unpatching...' : 'Unpatch'}
                    </Button>
                  ) : null}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
