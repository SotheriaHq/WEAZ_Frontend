import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import type { AppDispatch, RootState } from '@/store';
import type { AuthUserDto } from '@/types/auth';
import { setUser } from '@/features/userSlice';
import { brandApi } from '@/api/BrandApi';
import { useSignedFileUrl } from '@/hooks/useSignedFileUrl';
import ProfileHeader from './ProfileHeader';
import ImageCropModal from '@/components/upload/ImageCropModal';
import ProfileImageModal from '@/components/profile/ProfileImageModal';
import { resolveBannerImageSource, resolveProfileImageSource } from '@/utils/profileImage';

type OwnerHeaderProfileBase = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  address?: string;
  location?: string;
  verificationBadgeVisible?: boolean;
  isVerifiedBrand?: boolean;
  verifiedExplanationUrl?: string;
  tags?: string[];
  description?: string;
  isOwner: true;
  profileVisibility: 'UNLOCKED' | 'LOCKED';
  profileImage?: string | null;
  profileImageFileId?: string | null;
  bannerImage?: string | null;
  bannerImageFileId?: string | null;
};

interface OwnerCatalogMediaHeaderProps {
  profile: OwnerHeaderProfileBase;
  onEditProfile?: () => void;
  onShareProfile?: () => void;
  onShowQrCode?: () => void;
  showPatchAction?: boolean;
  isPatched?: boolean;
  patchLoading?: boolean;
  onTogglePatch?: () => void;
}

const mapUploadedMedia = (uploaded: any, fallbackFileName: string) => ({
  id: uploaded?.id ?? null,
  s3Url: uploaded?.url ?? null,
  fileName: uploaded?.fileName ?? fallbackFileName,
  originalName: uploaded?.originalName ?? fallbackFileName,
  createdAt: uploaded?.createdAt ?? new Date().toISOString(),
  updatedAt: uploaded?.updatedAt ?? new Date().toISOString(),
});

const OwnerCatalogMediaHeaderComponent: React.FC<OwnerCatalogMediaHeaderProps> = ({
  profile,
  onEditProfile,
  onShareProfile,
  onShowQrCode,
  showPatchAction = false,
  isPatched = false,
  patchLoading = false,
  onTogglePatch,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const currentUser = useSelector((state: RootState) => state.user.profile);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const avatarPreviewObjectUrl = useRef<string | null>(null);
  const bannerPreviewObjectUrl = useRef<string | null>(null);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [avatarHighlight, setAvatarHighlight] = useState(false);
  const [bannerPreviewUrl, setBannerPreviewUrlState] = useState<string | null>(null);
  const [localAvatarPreview, setLocalAvatarPreviewState] = useState<string | null>(null);
  const [cropTask, setCropTask] = useState<{ type: 'avatar' | 'banner'; file: File } | null>(null);

  const avatarAsset = useMemo(() => resolveProfileImageSource(currentUser), [currentUser]);
  const bannerAsset = useMemo(() => resolveBannerImageSource(currentUser), [currentUser]);
  const avatarFileId = avatarAsset.fileId;
  const avatarInitial = avatarAsset.src;
  const bannerFileId = bannerAsset.fileId;
  const bannerInitial = bannerAsset.src;

  const { url: resolvedAvatarUrl } = useSignedFileUrl(avatarFileId, avatarInitial);
  const { url: resolvedBannerUrl } = useSignedFileUrl(bannerFileId, bannerInitial);

  const updateAvatarPreview = useCallback((url: string | null) => {
    const current = avatarPreviewObjectUrl.current;
    if (current && current !== url) {
      URL.revokeObjectURL(current);
      avatarPreviewObjectUrl.current = null;
    }
    if (url && url.startsWith('blob:')) {
      avatarPreviewObjectUrl.current = url;
    } else if (!url) {
      avatarPreviewObjectUrl.current = null;
    }
    setLocalAvatarPreviewState(url);
  }, []);

  const updateBannerPreview = useCallback((url: string | null) => {
    const current = bannerPreviewObjectUrl.current;
    if (current && current !== url) {
      URL.revokeObjectURL(current);
      bannerPreviewObjectUrl.current = null;
    }
    if (url && url.startsWith('blob:')) {
      bannerPreviewObjectUrl.current = url;
    } else if (!url) {
      bannerPreviewObjectUrl.current = null;
    }
    setBannerPreviewUrlState(url);
  }, []);

  useEffect(() => {
    return () => {
      if (avatarPreviewObjectUrl.current) {
        URL.revokeObjectURL(avatarPreviewObjectUrl.current);
      }
      if (bannerPreviewObjectUrl.current) {
        URL.revokeObjectURL(bannerPreviewObjectUrl.current);
      }
    };
  }, []);

  useEffect(() => {
    if (
      bannerPreviewUrl?.startsWith('blob:') &&
      resolvedBannerUrl &&
      resolvedBannerUrl !== bannerPreviewUrl
    ) {
      updateBannerPreview(null);
    }
  }, [bannerPreviewUrl, resolvedBannerUrl, updateBannerPreview]);

  useEffect(() => {
    if (resolvedAvatarUrl && (!localAvatarPreview || localAvatarPreview.startsWith('blob:'))) {
      updateAvatarPreview(resolvedAvatarUrl);
    }
  }, [localAvatarPreview, resolvedAvatarUrl, updateAvatarPreview]);

  const persistUserMedia = useCallback(
    (nextUser: AuthUserDto) => {
      dispatch(setUser(nextUser));
    },
    [dispatch],
  );

  const processAvatarUpload = useCallback(
    async (file: File, previewUrl: string, disposePreview?: () => void) => {
      if (!currentUser) {
        disposePreview?.();
        return;
      }

      const previousPreview = localAvatarPreview ?? resolvedAvatarUrl ?? null;
      updateAvatarPreview(previewUrl);
      setAvatarUploading(true);

      try {
        const uploaded = await brandApi.uploadLogo(currentUser.id, file);
        if (!uploaded) {
          throw new Error('No upload payload returned');
        }

        const signedUrl = (await brandApi.getSignedFileUrl(uploaded.id)) ?? uploaded.url;
        updateAvatarPreview(signedUrl);
        persistUserMedia({
          ...currentUser,
          profileImage: uploaded.url,
          profileImageId: uploaded.id,
          profileImageFile: mapUploadedMedia(uploaded, file.name),
        });
        setAvatarHighlight(true);
        toast.success('Profile photo updated');
      } catch (error) {
        console.error('Failed to upload profile photo', error);
        updateAvatarPreview(previousPreview);
        toast.error('Could not update profile photo. Please try again.');
      } finally {
        setAvatarUploading(false);
        disposePreview?.();
      }
    },
    [currentUser, localAvatarPreview, persistUserMedia, resolvedAvatarUrl, updateAvatarPreview],
  );

  const processBannerUpload = useCallback(
    async (file: File, previewUrl: string, disposePreview?: () => void) => {
      if (!currentUser) {
        disposePreview?.();
        return;
      }

      const previousPreview = bannerPreviewUrl ?? resolvedBannerUrl ?? null;
      updateBannerPreview(previewUrl);
      setBannerUploading(true);

      try {
        const uploaded = await brandApi.uploadBanner(currentUser.id, file);
        if (!uploaded) {
          throw new Error('No banner upload payload returned');
        }

        const signedUrl = (await brandApi.getSignedFileUrl(uploaded.id)) ?? uploaded.url;
        updateBannerPreview(signedUrl);
        persistUserMedia({
          ...currentUser,
          bannerImage: uploaded.url,
          bannerImageId: uploaded.id,
          bannerImageFile: mapUploadedMedia(uploaded, file.name),
        });
        toast.success('Banner image updated');
      } catch (error) {
        console.error('Failed to upload banner image', error);
        updateBannerPreview(previousPreview);
        toast.error('Could not update banner. Please try again.');
      } finally {
        setBannerUploading(false);
        disposePreview?.();
      }
    },
    [bannerPreviewUrl, currentUser, persistUserMedia, resolvedBannerUrl, updateBannerPreview],
  );

  const handleTriggerAvatarUpload = useCallback(() => {
    avatarInputRef.current?.click();
  }, []);

  const handleTriggerBannerUpload = useCallback(() => {
    bannerInputRef.current?.click();
  }, []);

  const handleAvatarSelected: React.ChangeEventHandler<HTMLInputElement> = useCallback((event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setCropTask({ type: 'avatar', file });
  }, []);

  const handleBannerSelected: React.ChangeEventHandler<HTMLInputElement> = useCallback((event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setCropTask({ type: 'banner', file });
  }, []);

  const handleCropConfirm = useCallback(
    async (result: { file: File; previewUrl: string; disposePreview: () => void }) => {
      const activeTask = cropTask;
      setCropTask(null);
      if (!activeTask) {
        result.disposePreview();
        return;
      }

      if (activeTask.type === 'avatar') {
        await processAvatarUpload(result.file, result.previewUrl, result.disposePreview);
        return;
      }

      await processBannerUpload(result.file, result.previewUrl, result.disposePreview);
    },
    [cropTask, processAvatarUpload, processBannerUpload],
  );

  const handleCropUseOriginal = useCallback(
    async (result: { file: File; previewUrl: string; disposePreview: () => void }) => {
      const activeTask = cropTask;
      setCropTask(null);
      if (!activeTask || activeTask.type !== 'avatar') {
        result.disposePreview();
        return;
      }
      await processAvatarUpload(result.file, result.previewUrl, result.disposePreview);
    },
    [cropTask, processAvatarUpload],
  );

  const handleViewAvatar = useCallback(() => {
    if (localAvatarPreview || resolvedAvatarUrl) {
      setIsAvatarModalOpen(true);
      if (avatarHighlight) {
        setAvatarHighlight(false);
      }
    }
  }, [avatarHighlight, localAvatarPreview, resolvedAvatarUrl]);

  const headerProfile = useMemo(
    () => ({
      ...profile,
      profileImage: (localAvatarPreview ?? resolvedAvatarUrl) ?? undefined,
      profileImageFileId: avatarFileId,
      bannerImage: (bannerPreviewUrl ?? resolvedBannerUrl) ?? undefined,
      bannerImageFileId: bannerFileId,
    }),
    [avatarFileId, bannerFileId, bannerPreviewUrl, localAvatarPreview, profile, resolvedAvatarUrl, resolvedBannerUrl],
  );

  return (
    <>
      <input
        id="avatar-file-input"
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarSelected}
      />
      <input
        id="banner-file-input"
        ref={bannerInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleBannerSelected}
      />

      <ProfileHeader
        profile={headerProfile}
        canEdit
        onEditProfile={onEditProfile}
        onShareProfile={onShareProfile}
        onShowQrCode={onShowQrCode}
        onEditAvatar={handleTriggerAvatarUpload}
        onEditBanner={handleTriggerBannerUpload}
        avatarLoading={avatarUploading}
        bannerLoading={bannerUploading}
        avatarHighlight={avatarHighlight}
        onViewAvatar={handleViewAvatar}
        showPatchAction={showPatchAction}
        isPatched={isPatched}
        patchLoading={patchLoading}
        onTogglePatch={onTogglePatch}
      />

      <ProfileImageModal
        open={isAvatarModalOpen && Boolean(localAvatarPreview ?? resolvedAvatarUrl)}
        src={(localAvatarPreview ?? resolvedAvatarUrl) ?? undefined}
        alt={profile.firstName}
        onClose={() => setIsAvatarModalOpen(false)}
      />

      <ImageCropModal
        open={Boolean(cropTask)}
        file={cropTask?.file ?? null}
        aspect={cropTask?.type === 'banner' ? 3.2 : 1}
        title={cropTask?.type === 'banner' ? 'Crop banner image' : 'Adjust profile photo'}
        enforceAspect={cropTask?.type === 'banner'}
        allowUseOriginal={cropTask?.type === 'avatar'}
        onConfirm={handleCropConfirm}
        onUseOriginal={cropTask?.type === 'avatar' ? handleCropUseOriginal : undefined}
        onClose={() => setCropTask(null)}
      />
    </>
  );
};

export default React.memo(OwnerCatalogMediaHeaderComponent);
