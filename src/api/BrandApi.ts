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
// In‑memory cache for categories to improve perceived reliability and reduce re-fetch churn
const categoriesCache: {
  items: Array<{ id: string; slug: string; name: string; description?: string | null }>;
  lastFetched: number;
} = { items: [], lastFetched: 0 };
const CATEGORIES_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const brandApi = {
  async getCategories(force = false): Promise<Array<{ id: string; slug: string; name: string; description?: string | null }>> {
    // Serve cached categories if fresh and not forcing a reload
    if (!force && categoriesCache.items.length && Date.now() - categoriesCache.lastFetched < CATEGORIES_TTL_MS) {
      return categoriesCache.items;
    }
    try {
      const response = await apiClient.get(`/collections/categories`);
      // Support plain array or wrapped { data } or nested { data: { data } }
      const payload = (response?.data ?? undefined) as unknown;
      const items = Array.isArray(payload)
        ? payload
        : Array.isArray((payload as any)?.data)
          ? (payload as any).data
          : Array.isArray((payload as any)?.data?.data)
            ? (payload as any).data.data
            : [];

      const mapped = items.map((c: any) => ({
        id: String(c?.id ?? ''),
        slug: String(c?.slug ?? ''),
        name: String(c?.name ?? ''),
        description: c?.description ?? null,
      }));

      categoriesCache.items = mapped;
      categoriesCache.lastFetched = Date.now();
      return mapped;
    } catch (e: any) {
      const isNetworkError = !e?.response;
      console.error('Error fetching categories', e);
      // If we have a stale cache, surface it rather than returning empty so UI remains populated
      if (categoriesCache.items.length) {
        return categoriesCache.items;
      }
      // Provide synthetic fallback list for offline scenario to avoid an empty select
      if (isNetworkError) {
        return [
          { id: 'fallback-african-fashion', slug: 'african-fashion', name: 'African Fashion', description: 'Fallback category' },
          { id: 'fallback-western-fashion', slug: 'western-fashion', name: 'Western Fashion', description: 'Fallback category' },
          { id: 'fallback-de-house', slug: 'de-house', name: 'De House', description: 'Fallback category' },
        ];
      }
      return [];
    }
  },
  async listBrandAccessRequests(
    brandId: string,
    args?: { status?: 'pending' | 'approved'; cursor?: string; limit?: number; q?: string; page?: number; pageSize?: number }
  ) {
    const params = new URLSearchParams();
    if (args?.status) params.set('status', args.status);
    if (args?.cursor) params.set('cursor', args.cursor);
    if (args?.limit) params.set('limit', String(args.limit));
    if (args?.q) params.set('q', args.q);
    if (args?.page) params.set('page', String(args.page));
    if (args?.pageSize) params.set('pageSize', String(args.pageSize));
    const res = await apiClient.get(`/brands/${brandId}/private-access/requests?${params.toString()}`);
    const payload = res.data;
    const container: any = payload?.data ?? payload ?? {};
    const items = (container?.items ?? []) as any[];
    return {
      items: items.map((r: any) => ({
        id: r.id,
        collectionId: r.collectionId,
        title: r.collection?.title ?? '',
        viewer: r.viewer ?? null,
        state: r.state,
        createdAt: r.createdAt,
      })),
      hasNextPage: container?.hasNextPage,
      endCursor: container?.endCursor ?? null,
      totalCount: container?.totalCount,
      page: container?.page,
      pageSize: container?.pageSize,
      totalPages: container?.totalPages,
    };
  },
  async brandUpdateAccess(brandId: string, collectionId: string, userId: string, state: 'APPROVED' | 'REVOKED') {
    const res = await apiClient.patch(`/brands/${brandId}/private-access/${collectionId}/${userId}`, { state });
    return res.data?.data ?? res.data;
  },
  async brandRejectAccess(brandId: string, collectionId: string, userId: string) {
    const res = await apiClient.patch(`/brands/${brandId}/private-access/${collectionId}/${userId}/reject`);
    return res.data?.data ?? res.data;
  },

  // Request access to a private collection
  async requestPrivateAccess(collectionId: string): Promise<{ state: 'PENDING' | 'APPROVED'; cooldownActive?: boolean; nextAllowedAt?: string } | null> {
    try {
      const response = await apiClient.post(`/collections/${collectionId}/access-requests`);
      const payload = response.data;
        return (payload?.data ?? payload) as { state: 'PENDING' | 'APPROVED'; cooldownActive?: boolean; nextAllowedAt?: string };
    } catch (error) {
      console.error('Error requesting private access:', error);
      return null;
    }
  },

  // Viewer access states for a brand's private collections
  async getBrandPrivateStates(brandId: string): Promise<Array<{ collectionId: string; title: string; coverUrl?: string | null; coverFileId?: string | null; itemCount?: number; state: 'APPROVED' | 'PENDING' | 'REVOKED' | 'NONE' }>> {
    try {
      const response = await apiClient.get(`/brands/${brandId}/private-access/my-states`);
      const payload = response.data;
      const items = (payload?.data?.items ?? payload?.items ?? []) as any[];
      return items.map((it) => ({
        collectionId: String(it.collectionId),
        title: String(it.title ?? ''),
        coverUrl: it.coverUrl ?? null,
        coverFileId: typeof it.coverFileId === 'string' ? it.coverFileId : undefined,
        itemCount: typeof it.itemCount === 'number' ? it.itemCount : undefined,
        state: (it.state as any) ?? 'NONE',
      }));
    } catch (error) {
      console.error('Error fetching brand private states:', error);
      return [];
    }
  },
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
  async getCollections(ownerId: string, opts?: { visibility?: 'public' | 'private' | 'all' }): Promise<CollectionDto[]> {
    try {
      const params = new URLSearchParams();
      if (opts?.visibility) params.append('visibility', opts.visibility);
      const query = params.toString();
      console.debug('[BrandApi.getCollections] request', { ownerId, visibility: opts?.visibility ?? 'all' });
      const response = await apiClient.get(`/collections/user/${ownerId}${query ? `?${query}` : ''}`);
      const data = unwrapApiResponse<{ items: unknown[]; hasNextPage: boolean; endCursor?: string }>(response.data);
      
      // Transform backend data to frontend format
      const items = Array.isArray(data?.items) ? data.items : [];
      const mapped = items.map((item: unknown) => {
        const backendItem = item as Record<string, unknown>;
        const medias = (backendItem.medias as Array<{ id?: string; commentsCount?: number; likesCount?: number; file?: { url?: string; s3Url?: string; id?: string } }>) || [];
        const coverMediaId = (backendItem as any)?.coverMediaId as string | undefined;
        const preferredMedia = (coverMediaId && medias.find((m) => String(m.id) === String(coverMediaId))) || medias[0] || null;
        const fileObj = (preferredMedia?.file as { url?: string; s3Url?: string; id?: string } | undefined) ?? undefined;
        const coverImageUrl =
          (fileObj?.s3Url && typeof fileObj.s3Url === 'string' ? fileObj.s3Url : undefined) ||
          (fileObj?.url && typeof fileObj.url === 'string' ? fileObj.url : undefined) ||
          '';
        const coverFileId = typeof fileObj?.id === 'string' ? fileObj!.id : undefined;
        const countObj = (backendItem._count as { medias?: number } | undefined) ?? undefined;
        const mediaCount = typeof countObj?.medias === 'number' ? countObj!.medias! : ((backendItem.medias as unknown[])?.length || 0);
        // Aggregate total likes/comments: include media-level counts if available
        const baseLikes = (backendItem as any)?.likesCount as number | undefined;
        const baseComments = (backendItem as any)?.commentsCount as number | undefined;
        const mediaLikesSum = Array.isArray(medias) ? medias.reduce((sum, m) => sum + (m?.likesCount || 0), 0) : 0;
        const mediaCommentsSum = Array.isArray(medias) ? medias.reduce((sum, m) => sum + (m?.commentsCount || 0), 0) : 0;
        const totalLikes = (baseLikes || 0) + mediaLikesSum;
        const totalComments = (baseComments || 0) + mediaCommentsSum;
        const visibility =
          ((backendItem as any).visibility as any) ??
          (backendItem.status === 'PUBLISHED' ? 'PUBLIC' : 'PRIVATE');

        const out = {
          id: backendItem.id as string,
          name: (backendItem.title as string) || '',
          title: (backendItem.title as string) || '',
          description: (backendItem.description as string) || '',
          ownerId: backendItem.ownerId as string,
          // Public/private derives from Collection.visibility, not publish status
          isPublic: visibility === 'PUBLIC',
          visibility,
          type: (backendItem as any).type as any,
          categoryId: (backendItem.categoryId as string) || undefined,
          coverImage: coverImageUrl,
          coverFileId,
          itemCount: mediaCount,
          postsCount: mediaCount,
          likesCount: totalLikes,
          commentsCount: totalComments,
          minPrice: (backendItem.minPrice as number) || 0,
          maxPrice: (backendItem.maxPrice as number) || 0,
          // Include sale fields so profile cards reflect active sales
          saleMinPrice: (backendItem as any)?.saleMinPrice ?? null,
          saleMaxPrice: (backendItem as any)?.saleMaxPrice ?? null,
          saleStartAt: (backendItem as any)?.saleStartAt ?? null,
          saleEndAt: (backendItem as any)?.saleEndAt ?? null,
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
        return out;
      });
      try {
        const totals = mapped.reduce((acc, c) => {
          acc.all += 1;
          if ((c as any).visibility === 'PRIVATE') acc.private += 1; else acc.public += 1;
          return acc;
        }, { all: 0, public: 0, private: 0 } as any);
        console.debug('[BrandApi.getCollections] response', { count: mapped.length, ...totals });
      } catch {}
      return mapped;
    } catch (error) {
      console.error('Error fetching collections:', error);
      return [];
    }
  },

  // Fetch draft collections (PHASE 6)
  async getMyDraftCollections(): Promise<any[]> {
    try {
      const response = await apiClient.get('/collections/my/drafts');
      return response.data?.items ?? response.data ?? [];
    } catch (error) {
      console.error('Error fetching draft collections:', error);
      return [];
    }
  },

  // Create collection
  async createCollection(data: { name: string; description?: string; isPublic?: boolean; categoryId?: string; type?: 'MALE' | 'FEMALE' | 'EVERYBODY' }): Promise<CollectionDto | null> {
    try {
      const payload: any = {
        name: data.name,
        description: data.description,
        isPublic: data.isPublic,
        // map to backend DTO fields when create endpoint is available
        visibility: data.isPublic === false ? 'PRIVATE' : 'PUBLIC',
        categoryId: data.categoryId,
        type: data.type ?? 'EVERYBODY',
      };
      const response = await apiClient.post('/collections', payload);
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
  // Delete a single item (media) from a collection
  async deleteCollectionItem(collectionId: string, itemId: string): Promise<boolean> {
    try {
      await apiClient.delete(`/collections/${collectionId}/items/${itemId}`);
      return true;
    } catch (error) {
      console.error('Error deleting collection item:', error);
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
    } catch (error: any) {
      console.error('Error fetching collection detail:', error);
      // Propagate the error so components can handle permission/not-found cases
      // Don't return null - throw the error to allow proper error handling
      if (error?.response?.status === 404 || error?.response?.status === 403) {
        throw error;
      }
      // For other errors, return null for backward compatibility
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


