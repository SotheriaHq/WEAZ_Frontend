import { apiClient } from './httpClient';
import { unwrapApiResponse, type AuthUserDto } from '../types/auth';
import type {
  CollectionDto,
  ReviewDto,
  BrandProfileDto,
} from '../types/profile';

export interface UpdateBrandProfilePayload {
  brandFullName?: string;
  brandDescription: string;
  brandCountry?: string;
  brandState?: string;
  brandCity?: string;
  brandTags?: string[];
  socialInstagram?: string;
  socialFacebook?: string;
  socialTwitter?: string;
  socialWebsite?: string;
  phoneNumber?: string;
  businessType?: string;
}

export interface UploadAssetDto {
  id: string;
  url: string;
  key: string;
  fileName: string;
  originalName: string;
  size: number;
  mimeType: string;
  fileType: string;
  createdAt: string;
  updatedAt: string;
}

const SIGNED_URL_TTL_MS = 4 * 60 * 1000;
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const signedUrlPending = new Map<string, Promise<string | null>>();

// Brand Profile API
export const brandApi = {
  // Fetch brand profile details
  async getBrandProfile(brandId: string): Promise<BrandProfileDto | null> {
    try {
      const response = await apiClient.get(`/brands/${brandId}`);
      return unwrapApiResponse<BrandProfileDto>(response.data);
    } catch (error) {
      console.error('Error fetching brand profile:', error);
      return null;
    }
  },

  // Update brand profile
  async updateBrandProfile(brandId: string, data: UpdateBrandProfilePayload): Promise<AuthUserDto | null> {
    try {
      const response = await apiClient.patch(`/brands/${brandId}`, data);
      return unwrapApiResponse<AuthUserDto>(response.data);
    } catch (error) {
      console.error('Error updating brand profile:', error);
      return null;
    }
  },

  // Fetch collections
  async getCollections(ownerId: string): Promise<CollectionDto[]> {
    try {
      const response = await apiClient.get(`/collections/user/${ownerId}`);
      const data = unwrapApiResponse<{ items: unknown[]; hasNextPage: boolean; endCursor?: string }>(response.data);
      
      // Transform backend data to frontend format
      const items = Array.isArray(data?.items) ? data.items : [];
      return items.map((item: unknown) => {
        const backendItem = item as Record<string, unknown>;
        const medias = (backendItem.medias as Array<{ file?: { url?: string; s3Url?: string; id?: string } }>) || [];
        const firstMedia = medias[0] ?? null;
        const fileObj = (firstMedia?.file as { url?: string; s3Url?: string; id?: string } | undefined) ?? undefined;
        const coverImageUrl =
          (fileObj?.s3Url && typeof fileObj.s3Url === 'string' ? fileObj.s3Url : undefined) ||
          (fileObj?.url && typeof fileObj.url === 'string' ? fileObj.url : undefined) ||
          '';
        const coverFileId = typeof fileObj?.id === 'string' ? fileObj!.id : undefined;
        const countObj = (backendItem._count as { medias?: number } | undefined) ?? undefined;
        const mediaCount = typeof countObj?.medias === 'number' ? countObj!.medias! : ((backendItem.medias as unknown[])?.length || 0);
        return {
          id: backendItem.id as string,
          name: (backendItem.title as string) || '',
          title: (backendItem.title as string) || '',
          description: (backendItem.description as string) || '',
          ownerId: backendItem.ownerId as string,
          isPublic: backendItem.status === 'PUBLISHED',
          coverImage: coverImageUrl,
          coverFileId,
          itemCount: mediaCount,
          postsCount: mediaCount,
          likesCount: (backendItem.likesCount as number) || 0,
          commentsCount: (backendItem.commentsCount as number) || 0,
          minPrice: (backendItem.minPrice as number) || 0,
          maxPrice: (backendItem.maxPrice as number) || 0,
          isAvailableInStore: (backendItem.isAvailableInStore as boolean) || false,
          createdAt: backendItem.createdAt as string,
          updatedAt: backendItem.updatedAt as string,
          brandName: ((backendItem.owner as Record<string, unknown>)?.brandFullName as string) || ((backendItem.owner as Record<string, unknown>)?.username as string) || '',
          username: ((backendItem.owner as Record<string, unknown>)?.username as string) || '',
          brandLogo: ((backendItem.owner as Record<string, unknown>)?.profileImage as string) || '',
          brandLogoFileId:
            ((backendItem.owner as Record<string, unknown>)?.profileImageFile as { id?: string } | undefined)?.id ||
            ((backendItem.owner as Record<string, unknown>)?.profileImageId as string | undefined) ||
            undefined,
          tags: Array.isArray(backendItem.tags)
            ? (backendItem.tags as unknown[]).map((tag) => (typeof tag === 'string' ? tag : '')).filter(Boolean)
            : [],
        };
      });
    } catch (error) {
      console.error('Error fetching collections:', error);
      return [];
    }
  },

  // Create collection
  async createCollection(data: { name: string; description?: string; isPublic?: boolean }): Promise<CollectionDto | null> {
    try {
      const response = await apiClient.post('/collections', data);
      return unwrapApiResponse<CollectionDto>(response.data);
    } catch (error) {
      console.error('Error creating collection:', error);
      return null;
    }
  },

  // Update collection
  async updateCollection(collectionId: string, data: Partial<CollectionDto>): Promise<CollectionDto | null> {
    try {
      const response = await apiClient.patch(`/collections/${collectionId}`, data);
      return unwrapApiResponse<CollectionDto>(response.data);
    } catch (error) {
      console.error('Error updating collection:', error);
      return null;
    }
  },

  // Delete collection
  async deleteCollection(collectionId: string): Promise<boolean> {
    try {
      await apiClient.delete(`/collections/${collectionId}`);
      return true;
    } catch (error) {
      console.error('Error deleting collection:', error);
      return false;
    }
  },

  // Fetch reviews
  async getReviews(brandId: string): Promise<{ reviews: ReviewDto[]; averageRating: number; totalReviews: number }> {
    try {
      const response = await apiClient.get(`/reviews`, {
        params: { brandId },
      });
      const data = unwrapApiResponse<{ reviews: ReviewDto[]; averageRating: number; totalReviews: number }>(response.data);
      return {
        reviews: Array.isArray(data.reviews) ? data.reviews : [],
        averageRating: data.averageRating || 0,
        totalReviews: data.totalReviews || 0,
      };
    } catch (error) {
      console.error('Error fetching reviews:', error);
      return { reviews: [], averageRating: 0, totalReviews: 0 };
    }
  },

  // Upload banner image
  async uploadBanner(_brandId: string, file: File): Promise<UploadAssetDto | null> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiClient.post(`/uploads/banner-image`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return extractUploadAsset(response.data);
    } catch (error) {
      console.error('Error uploading banner:', error);
      return null;
    }
  },

  // Upload logo image
  async uploadLogo(_brandId: string, file: File): Promise<UploadAssetDto | null> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiClient.post(`/uploads/profile-image`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return extractUploadAsset(response.data);
    } catch (error) {
      console.error('Error uploading logo:', error);
      return null;
    }
  },

  async getSignedFileUrl(fileId: string): Promise<string | null> {
    const existing = signedUrlCache.get(fileId);
    if (existing && existing.expiresAt > Date.now()) {
      return existing.url;
    }

    const inflight = signedUrlPending.get(fileId);
    if (inflight) {
      return inflight;
    }

    const request = (async (): Promise<string | null> => {
      try {
        // Try public endpoint first (no auth required)
        const response = await apiClient.get(`/uploads/public-url/${fileId}`);
        const payload = unwrapApiResponse<{ url?: string }>(response.data);
        const directUrl =
          (payload as { url?: string })?.url ??
          (response.data as { url?: string })?.url ??
          null;
        if (typeof directUrl === 'string') {
          signedUrlCache.set(fileId, {
            url: directUrl,
            expiresAt: Date.now() + SIGNED_URL_TTL_MS,
          });
          return directUrl;
        }
        return null;
        } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'response' in error &&
          (error as { response?: { status?: number } }).response?.status === 429
        ) {
          console.warn('Signed URL request throttled, falling back to cached URL');
        } else {
          console.error('Error generating signed file URL:', error);
        }
        return existing?.url ?? null;
      } finally {
        signedUrlPending.delete(fileId);
      }
    })();

    signedUrlPending.set(fileId, request);
    return request;
  },
  // Get one collection with medias
  async getCollectionDetail(collectionId: string): Promise<any> {
    try {
      const response = await apiClient.get(`/collections/${collectionId}`);
      return unwrapApiResponse<any>(response.data);
    } catch (error) {
      console.error('Error fetching collection detail:', error);
      return null;
    }
  },
};

const extractUploadAsset = (raw: unknown): UploadAssetDto | null => {
  if (!raw || typeof raw !== 'object') return null;
  const container =
    'data' in raw && raw && typeof (raw as Record<string, unknown>).data === 'object'
      ? (raw as Record<string, unknown>).data
      : raw;
  if (!container || typeof container !== 'object') return null;

  const source = container as Record<string, unknown>;

  const id = typeof source.id === 'string' ? source.id : null;
  const urlCandidate =
    (typeof source.url === 'string' && source.url) ||
    (typeof source.s3Url === 'string' && source.s3Url) ||
    (typeof source.Location === 'string' && source.Location) ||
    (typeof source.location === 'string' && source.location) ||
    null;
  const createdAt =
    typeof source.createdAt === 'string' ? source.createdAt : null;
  const updatedAt =
    typeof source.updatedAt === 'string' ? source.updatedAt : null;

  if (!id || !urlCandidate || !createdAt || !updatedAt) {
    return null;
  }

  const key = typeof source.key === 'string' ? source.key : '';
  const fileName =
    typeof source.fileName === 'string'
      ? source.fileName
      : key.split('/').pop() ?? '';
  const originalName =
    typeof source.originalName === 'string'
      ? source.originalName
      : fileName ?? '';
  const size = typeof source.size === 'number' ? source.size : 0;
  const mimeType =
    typeof source.mimeType === 'string' ? source.mimeType : 'application/octet-stream';
  const fileType =
    typeof source.fileType === 'string' ? source.fileType : 'UNKNOWN';

  return {
    id,
    url: urlCandidate,
    key,
    fileName,
    originalName,
    size,
    mimeType,
    fileType,
    createdAt,
    updatedAt,
  };
};

