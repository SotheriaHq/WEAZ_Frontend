import { apiClient } from './httpClient';
import { isAxiosError } from 'axios';
import { reviewsApi, type ProductReviewResponse } from './ReviewsApi';
import { unwrapApiResponse, type AuthUserDto } from '../types/auth';
import type {
  CollectionDto,
  BrandProfileDto,
  ReviewRatingDistributionItem,
} from '../types/profile';
import type {
  VerificationDraftData,
  VerificationDraftResponse,
  VerificationLetterResponse,
  VerificationStatusResponse,
  VerificationUploadInstruction,
  VerificationUploadResult,
} from '../types/verification';

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

export type CollectionScope = 'design' | 'store' | 'all';

const getCollectionBasePath = (scope?: CollectionScope) =>
  scope === 'store' ? '/store-collections' : scope === 'all' ? '/collections' : '/designs';

const SIGNED_URL_TTL_MS = 4 * 60 * 1000;
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const signedUrlPending = new Map<string, Promise<string | null>>();
const VERIFICATION_STATUS_TTL_MS = 1500;
const verificationStatusCache = new Map<
  string,
  { data: VerificationStatusResponse; expiresAt: number }
>();
const verificationStatusPending = new Map<
  string,
  Promise<VerificationStatusResponse>
>();

export type CategoryTypeOption = {
  id: string;
  categoryId: string;
  slug: string;
  name: string;
  description?: string | null;
  order?: number;
};

export type CategoryOption = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  types?: CategoryTypeOption[];
};

export type FilterValueOption = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  order?: number;
};

export type FilterDimensionOption = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  isMulti: boolean;
  appliesTo: string[];
  values: FilterValueOption[];
};

// Brand Profile API
// In‑memory cache for categories to improve perceived reliability and reduce re-fetch churn
const categoriesCache: {
  items: CategoryOption[];
  lastFetched: number;
} = { items: [], lastFetched: 0 };
const CATEGORIES_TTL_MS = 5 * 60 * 1000; // 5 minutes

const extractArrayPayload = (payload: unknown): any[] => {
  if (Array.isArray(payload)) return payload;

  const candidate = payload as any;
  if (Array.isArray(candidate?.data)) return candidate.data;
  if (Array.isArray(candidate?.data?.data)) return candidate.data.data;
  if (Array.isArray(candidate?.items)) return candidate.items;
  if (Array.isArray(candidate?.data?.items)) return candidate.data.items;

  return [];
};

const mapCategories = (
  payload: unknown,
): CategoryOption[] => {
  const items = extractArrayPayload(payload);

  return items
    .map((c: any) => ({
      id: String(c?.id ?? ''),
      slug: String(c?.slug ?? ''),
      name: String(c?.name ?? ''),
      description: c?.description ?? null,
      types: Array.isArray(c?.types)
        ? c.types
          .map((t: any) => ({
            id: String(t?.id ?? ''),
            categoryId: String(t?.categoryId ?? c?.id ?? ''),
            slug: String(t?.slug ?? ''),
            name: String(t?.name ?? ''),
            description: t?.description ?? null,
            order:
              typeof t?.order === 'number' && Number.isFinite(t.order)
                ? t.order
                : undefined,
          }))
          .filter((t: CategoryTypeOption) => t.id.length > 0 && t.name.length > 0)
        : [],
    }))
    .filter((c: { id: string; name: string }) => c.id.length > 0 && c.name.length > 0);
};

const mapCategoriesWithSubCategories = (payload: unknown): CategoryOption[] => {
  const items = extractArrayPayload(payload);

  return items
    .map((c: any) => ({
      id: String(c?.id ?? ''),
      slug: String(c?.slug ?? ''),
      name: String(c?.name ?? ''),
      description: c?.description ?? null,
      types: Array.isArray(c?.subCategories ?? c?.types)
        ? (c.subCategories ?? c.types)
          .map((t: any) => ({
            id: String(t?.id ?? ''),
            categoryId: String(t?.categoryId ?? c?.id ?? ''),
            slug: String(t?.slug ?? ''),
            name: String(t?.name ?? ''),
            description: t?.description ?? null,
            order:
              typeof t?.order === 'number' && Number.isFinite(t.order)
                ? t.order
                : undefined,
          }))
          .filter((t: CategoryTypeOption) => t.id.length > 0 && t.name.length > 0)
        : [],
    }))
    .filter((c: CategoryOption) => c.id.length > 0 && c.name.length > 0);
};

const mapRatingDistribution = (
  ratingBreakdown: { 1: number; 2: number; 3: number; 4: number; 5: number },
  totalReviews: number,
): ReviewRatingDistributionItem[] => {
  return [5, 4, 3, 2, 1].map((stars) => {
    const count = ratingBreakdown[stars as 1 | 2 | 3 | 4 | 5] ?? 0;
    return {
      stars,
      count,
      percentage: totalReviews > 0 ? (count / totalReviews) * 100 : 0,
    };
  });
};

export const brandApi = {
  async getCategories(force = false): Promise<CategoryOption[]> {
    // Serve cached categories if fresh and not forcing a reload
    if (!force && categoriesCache.items.length && Date.now() - categoriesCache.lastFetched < CATEGORIES_TTL_MS) {
      return categoriesCache.items;
    }
    try {
      const response = await apiClient.get(`/collections/categories`, {
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      });
      if (response?.status === 304 && categoriesCache.items.length) {
        return categoriesCache.items;
      }
      let mapped = mapCategories((response?.data ?? undefined) as unknown);

      if (mapped.length === 0) {
        const bypassResponse = await apiClient.get(`/collections/categories`, {
          params: { _cb: Date.now() },
          headers: {
            'Cache-Control': 'no-store',
            Pragma: 'no-cache',
          },
        });
        mapped = mapCategories((bypassResponse?.data ?? undefined) as unknown);
      }

      if (mapped.length === 0) {
        try {
          const taxonomyResponse = await apiClient.get('/categories', {
            headers: {
              'Cache-Control': 'no-cache',
              Pragma: 'no-cache',
            },
          });
          mapped = mapCategoriesWithSubCategories((taxonomyResponse?.data ?? undefined) as unknown);

          if (mapped.length === 0) {
            const taxonomyBypassResponse = await apiClient.get('/categories', {
              params: { _cb: Date.now() },
              headers: {
                'Cache-Control': 'no-store',
                Pragma: 'no-cache',
              },
            });
            mapped = mapCategoriesWithSubCategories((taxonomyBypassResponse?.data ?? undefined) as unknown);
          }
        } catch {
          // Keep fallback behavior below.
        }
      }

      if (mapped.length === 0) return categoriesCache.items.length ? categoriesCache.items : [];

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
      if (isNetworkError) {
        return [];
      }
      return [];
    }
  },
  async getCategoryTypes(categoryId?: string, force = false): Promise<CategoryTypeOption[]> {
    if (!force && categoriesCache.items.length && Date.now() - categoriesCache.lastFetched < CATEGORIES_TTL_MS) {
      const fromCache = categoriesCache.items
        .flatMap((category) => category.types ?? [])
        .filter((type) => (categoryId ? type.categoryId === categoryId : true));
      if (fromCache.length > 0) return fromCache;
    }

    try {
      const response = await apiClient.get('/collections/category-types', {
        params: categoryId ? { categoryId } : undefined,
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      });

      const payload = response?.data;
      const items = extractArrayPayload(payload);

      const mapped = items
        .map((item: any) => ({
          id: String(item?.id ?? ''),
          categoryId: String(item?.categoryId ?? ''),
          slug: String(item?.slug ?? ''),
          name: String(item?.name ?? ''),
          description: item?.description ?? null,
          order:
            typeof item?.order === 'number' && Number.isFinite(item.order)
              ? item.order
              : undefined,
        }))
        .filter((item: CategoryTypeOption) => item.id.length > 0 && item.name.length > 0);

      if (mapped.length > 0) {
        return mapped.filter((type: CategoryTypeOption) =>
          categoryId ? type.categoryId === categoryId : true,
        );
      }

      const categories = await this.getCategoriesWithSubCategories(force);
      const fallback = categories.flatMap((category) => category.types ?? []);
      return fallback.filter((type: CategoryTypeOption) =>
        categoryId ? type.categoryId === categoryId : true,
      );
    } catch (error) {
      console.error('Error fetching sub-categories', error);
      const categories = await this.getCategoriesWithSubCategories(force);
      const fallback = categories.flatMap((category) => category.types ?? []);
      return fallback.filter((type: CategoryTypeOption) =>
        categoryId ? type.categoryId === categoryId : true,
      );
    }
  },
  async getVerificationStatus(
    brandId: string,
    options?: { force?: boolean },
  ): Promise<VerificationStatusResponse> {
    const force = Boolean(options?.force);
    const now = Date.now();

    if (!force) {
      const cached = verificationStatusCache.get(brandId);
      if (cached && cached.expiresAt > now) {
        return cached.data;
      }

      const pending = verificationStatusPending.get(brandId);
      if (pending) {
        return pending;
      }
    }

    const request = apiClient
      .get(`/brands/${brandId}/verification`)
      .then((response) => {
        const data = unwrapApiResponse<VerificationStatusResponse>(response.data);
        verificationStatusCache.set(brandId, {
          data,
          expiresAt: Date.now() + VERIFICATION_STATUS_TTL_MS,
        });
        return data;
      })
      .finally(() => {
        verificationStatusPending.delete(brandId);
      });

    verificationStatusPending.set(brandId, request);
    return request;
  },
  async getVerificationDraft(brandId: string): Promise<VerificationDraftResponse> {
    const response = await apiClient.get(`/brands/${brandId}/verification/draft`);
    return unwrapApiResponse<VerificationDraftResponse>(response.data);
  },
  async saveVerificationDraft(
    brandId: string,
    draftData: VerificationDraftData,
    currentStep?: number,
  ): Promise<{ ok: true; lastSavedAt: string }> {
    const response = await apiClient.patch(`/brands/${brandId}/verification/draft`, {
      draftData,
      currentStep,
    });
    return unwrapApiResponse<{ ok: true; lastSavedAt: string }>(response.data);
  },
  async getVerificationLetter(brandId: string): Promise<VerificationLetterResponse> {
    const response = await apiClient.get(`/brands/${brandId}/verification/letter`);
    return unwrapApiResponse<VerificationLetterResponse>(response.data);
  },
  async signVerificationLetter(
    brandId: string,
    data: { signatureImage: string; signatureMethod: 'TYPED' | 'DRAWN'; letterVersion: number; typedSignatureText?: string },
  ): Promise<{ letterKey: string; letterHash: string; letterVersion: number; signedAt: string }> {
    const response = await apiClient.post(`/brands/${brandId}/verification/letter/sign`, data);
    return unwrapApiResponse(response.data);
  },
  async presignVerificationUpload(
    brandId: string,
    data: { fileName: string; contentType: string; documentType: string },
  ): Promise<VerificationUploadInstruction> {
    const response = await apiClient.post(`/brands/${brandId}/verification/uploads/presign`, data);
    return unwrapApiResponse<VerificationUploadInstruction>(response.data);
  },
  async finalizeVerificationUpload(
    brandId: string,
    data: { fileId: string; key: string; actualMimeType: string; actualSize: number },
  ): Promise<VerificationUploadResult> {
    const response = await apiClient.post(`/brands/${brandId}/verification/uploads/finalize`, data);
    return unwrapApiResponse<VerificationUploadResult>(response.data);
  },
  async submitVerification(brandId: string, data: Record<string, unknown>) {
    const response = await apiClient.post(`/brands/${brandId}/verification`, data);
    return unwrapApiResponse(response.data);
  },
  async cancelVerification(brandId: string, expectedUpdatedAt?: string) {
    const response = await apiClient.post(`/brands/${brandId}/verification/cancel`, {
      expectedUpdatedAt,
    });
    return unwrapApiResponse(response.data);
  },
  async resubmitVerificationInfo(brandId: string, data: Record<string, unknown>) {
    const response = await apiClient.post(`/brands/${brandId}/verification/resubmit-info`, data);
    return unwrapApiResponse(response.data);
  },
  async setVerificationNudgeOptOut(brandId: string, nudgeOptOut: boolean) {
    const response = await apiClient.patch(`/brands/${brandId}/verification/nudge-optout`, {
      nudgeOptOut,
    });
    return unwrapApiResponse<{ nudgeOptOut: boolean; updatedAt: string }>(
      response.data,
    );
  },

  /**
   * Fetch all active categories with their sub-categories from the public endpoint.
   * Falls back to the existing getCategories() if the public endpoint is unavailable.
   */
  async getCategoriesWithSubCategories(force = false): Promise<CategoryOption[]> {
    if (!force && categoriesCache.items.length && Date.now() - categoriesCache.lastFetched < CATEGORIES_TTL_MS) {
      return categoriesCache.items;
    }
    try {
      const response = await apiClient.get('/categories', {
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      });
      let mapped = mapCategoriesWithSubCategories((response?.data ?? undefined) as unknown);

      if (mapped.length === 0) {
        const bypassResponse = await apiClient.get('/categories', {
          params: { _cb: Date.now() },
          headers: {
            'Cache-Control': 'no-store',
            Pragma: 'no-cache',
          },
        });
        mapped = mapCategoriesWithSubCategories((bypassResponse?.data ?? undefined) as unknown);
      }

      if (mapped.length > 0) {
        categoriesCache.items = mapped;
        categoriesCache.lastFetched = Date.now();
      }
      if (mapped.length > 0) return mapped;

      const fallback = await this.getCategories(force);
      return fallback.length > 0 ? fallback : categoriesCache.items;
    } catch {
      // Fall back to existing endpoint
      const fallback = await this.getCategories(force);
      return fallback.length > 0 ? fallback : categoriesCache.items;
    }
  },

  /**
   * Fetch all active filter dimensions with values.
   * Used by creation forms to populate filter selectors.
   */
  async getFilterDimensions(): Promise<FilterDimensionOption[]> {
    try {
      const response = await apiClient.get('/categories/filters');
      const payload = response?.data;
      const items = extractArrayPayload(payload);

      return items
        .map((d: any) => ({
          id: String(d?.id ?? ''),
          slug: String(d?.slug ?? ''),
          name: String(d?.name ?? ''),
          description: d?.description ?? null,
          isMulti: d?.isMulti ?? true,
          appliesTo: Array.isArray(d?.appliesTo) ? d.appliesTo : [],
          values: Array.isArray(d?.values)
            ? d.values
              .map((v: any) => ({
                id: String(v?.id ?? ''),
                slug: String(v?.slug ?? ''),
                name: String(v?.name ?? ''),
                description: v?.description ?? null,
                order: typeof v?.order === 'number' ? v.order : undefined,
              }))
              .filter((v: FilterValueOption) => v.id.length > 0 && v.name.length > 0)
            : [],
        }))
        .filter((d: FilterDimensionOption) => d.id.length > 0 && d.values.length > 0);
    } catch (error) {
      console.error('Error fetching filter dimensions', error);
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
        collection: {
          title: r.collection?.title ?? '',
        },
        viewer: r.viewer ? {
          id: r.viewer.id,
          username: r.viewer.username,
          firstName: r.viewer.firstName,
          lastName: r.viewer.lastName,
          profileImage: r.viewer.profileImage,
          profileImageId: r.viewer.profileImageId,
          profileImageFile: r.viewer.profileImageFile,
        } : null,
        coverUrl: r.collection?.medias?.[0]?.file?.s3Url ?? null,
        itemCount: r.collection?._count?.medias ?? 0,
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

  // ===================== User-scoped Private Access Management =====================

  /**
   * List all access requests sent by the current user
   */
  async listMyAccessRequests(args?: {
    status?: 'pending' | 'approved' | 'rejected';
    page?: number;
    pageSize?: number;
  }) {
    const params = new URLSearchParams();
    if (args?.status) params.set('status', args.status);
    if (args?.page) params.set('page', String(args.page));
    if (args?.pageSize) params.set('pageSize', String(args.pageSize));
    const res = await apiClient.get(`/users/me/private-access/requests?${params.toString()}`);
    const payload = res.data;
    const container: any = payload?.data ?? payload ?? {};
    const items = (container?.items ?? []) as any[];
    return {
      items: items.map((r: any) => ({
        id: r.id,
        collectionId: r.collectionId,
        title: r.title,
        brand: r.brand ? {
          id: r.brand.id,
          name: r.brand.name,
          profileImage: r.brand.profileImage,
          profileImageId: r.brand.profileImageId,
          profileImageFile: r.brand.profileImageFile,
        } : null,
        coverUrl: r.coverUrl,
        itemCount: r.itemCount,
        state: r.state,
        requestedAt: r.requestedAt,
        updatedAt: r.updatedAt,
      })),
      totalCount: container?.totalCount ?? 0,
      page: container?.page ?? 1,
      pageSize: container?.pageSize ?? 20,
      totalPages: container?.totalPages ?? 1,
      hasNextPage: container?.hasNextPage ?? false,
    };
  },

  /**
   * List all granted accesses for the current user
   */
  async listMyGrantedAccesses(args?: {
    page?: number;
    pageSize?: number;
  }) {
    const params = new URLSearchParams();
    if (args?.page) params.set('page', String(args.page));
    if (args?.pageSize) params.set('pageSize', String(args.pageSize));
    const res = await apiClient.get(`/users/me/private-access/granted?${params.toString()}`);
    const payload = res.data;
    const container: any = payload?.data ?? payload ?? {};
    const items = (container?.items ?? []) as any[];
    return {
      items: items.map((r: any) => ({
        id: r.id,
        collectionId: r.collectionId,
        title: r.title,
        brand: r.brand ? {
          id: r.brand.id,
          name: r.brand.name,
          profileImage: r.brand.profileImage,
          profileImageId: r.brand.profileImageId,
          profileImageFile: r.brand.profileImageFile,
        } : null,
        coverUrl: r.coverUrl,
        itemCount: r.itemCount,
        grantedAt: r.grantedAt,
      })),
      totalCount: container?.totalCount ?? 0,
      page: container?.page ?? 1,
      pageSize: container?.pageSize ?? 20,
      totalPages: container?.totalPages ?? 1,
      hasNextPage: container?.hasNextPage ?? false,
    };
  },

  /**
   * Cancel a pending access request
   */
  async cancelAccessRequest(requestId: string) {
    const res = await apiClient.patch(`/users/me/private-access/requests/${requestId}/cancel`);
    return res.data?.data ?? res.data;
  },

  /**
   * Revoke own access to a private collection
   */
  async revokeMyAccess(accessId: string) {
    const res = await apiClient.patch(`/users/me/private-access/granted/${accessId}/revoke`);
    return res.data?.data ?? res.data;
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
      const message = extractApiErrorMessage(error) ?? 'Error updating brand profile';
      console.error('Error updating brand profile:', message, error);
      throw new Error(message);
    }
  },

  // Fetch collections
  async getCollections(
    ownerId: string,
    opts?: {
      visibility?: 'public' | 'private' | 'all';
      scope?: CollectionScope;
      includeDeleted?: boolean;
      onlyDeleted?: boolean;
    },
  ): Promise<CollectionDto[]> {
    try {
      const resolvedScope = opts?.scope ?? 'design';
      if (resolvedScope === 'all') {
        const [designs, storeCollections] = await Promise.all([
          this.getCollections(ownerId, { ...opts, scope: 'design' }),
          this.getCollections(ownerId, { ...opts, scope: 'store' }),
        ]);
        return [...storeCollections, ...designs];
      }

      const params = new URLSearchParams();
      if (opts?.visibility) params.append('visibility', opts.visibility);
      if (opts?.includeDeleted) params.append('includeDeleted', 'true');
      if (opts?.onlyDeleted) params.append('onlyDeleted', 'true');
      params.append('_cb', String(Date.now()));
      const query = params.toString();
      const basePath = getCollectionBasePath(resolvedScope);
      const response = await apiClient.get(`${basePath}/user/${ownerId}${query ? `?${query}` : ''}`, {
        headers: {
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
      });
      const data = unwrapApiResponse<{ items: unknown[]; hasNextPage: boolean; endCursor?: string }>(response.data);

      // Transform backend data to frontend format
      const items = Array.isArray(data?.items) ? data.items : [];
      const mapped = items.map((item: unknown) => {
        const backendItem = item as Record<string, unknown>;
        const medias = (backendItem.medias as Array<{ id?: string; commentsCount?: number; threadsCount?: number; file?: { url?: string; s3Url?: string; id?: string } }>) || [];
        const coverMediaId = (backendItem as any)?.coverMediaId as string | undefined;
        const preferredMedia = (coverMediaId && medias.find((m) => String(m.id) === String(coverMediaId))) || medias[0] || null;
        const fileObj = (preferredMedia?.file as { url?: string; s3Url?: string; id?: string } | undefined) ?? undefined;
        const coverImageUrl =
          (fileObj?.s3Url && typeof fileObj.s3Url === 'string' ? fileObj.s3Url : undefined) ||
          (fileObj?.url && typeof fileObj.url === 'string' ? fileObj.url : undefined) ||
          '';
        const backendCoverImageRaw =
          (typeof (backendItem as any)?.coverImageUrl === 'string'
            ? ((backendItem as any).coverImageUrl as string)
            : '') ||
          (typeof (backendItem as any)?.coverImage === 'string'
            ? ((backendItem as any).coverImage as string)
            : '');
        const backendCoverFileId =
          typeof (backendItem as any)?.coverFileId === 'string'
            ? ((backendItem as any).coverFileId as string)
            : undefined;
        const productLinks = Array.isArray((backendItem as any).products)
          ? ((backendItem as any).products as Array<any>)
          : [];
        const sortedProductLinks = [...productLinks].sort((a: any, b: any) => {
          const aOrder =
            typeof a?.orderIndex === 'number' ? a.orderIndex : Number.MAX_SAFE_INTEGER;
          const bOrder =
            typeof b?.orderIndex === 'number' ? b.orderIndex : Number.MAX_SAFE_INTEGER;
          return aOrder - bOrder;
        });
        const isRemoteMediaValue = (value: unknown): value is string => {
          if (typeof value !== 'string') return false;
          return (
            value.startsWith('http') ||
            value.startsWith('/') ||
            value.startsWith('data:') ||
            value.includes('://') ||
            value.includes('?')
          );
        };
        const productCandidates = sortedProductLinks
          .map((link: any) => link?.product ?? link)
          .filter(Boolean);
        const firstProductWithCover = productCandidates.find((product: any) => {
          if (typeof product?.thumbnail === 'string' && product.thumbnail.length > 0) return true;
          return Array.isArray(product?.images)
            ? product.images.some((img: any) => typeof img === 'string' && img.length > 0)
            : false;
        });
        const rawProductCoverValue =
          typeof firstProductWithCover?.thumbnail === 'string'
            ? firstProductWithCover.thumbnail
            : Array.isArray(firstProductWithCover?.images)
              ? firstProductWithCover.images.find((img: any) => typeof img === 'string' && img.length > 0)
              : undefined;
        const productCoverUrl = isRemoteMediaValue(rawProductCoverValue)
          ? rawProductCoverValue
          : undefined;
        const productMedia = Array.isArray(firstProductWithCover?.media)
          ? (firstProductWithCover.media as Array<{ id?: string; isPrimary?: boolean }>)
          : [];
        const productPrimaryMedia = productMedia.find((m) => m?.isPrimary) || productMedia[0];
        const productCoverFileId =
          (typeof productPrimaryMedia?.id === 'string' && !productPrimaryMedia.id.startsWith('http')
            ? productPrimaryMedia.id
            : undefined) ||
          (Array.isArray(firstProductWithCover?.mediaIds)
            ? firstProductWithCover.mediaIds.find((id: unknown) => typeof id === 'string' && !id.startsWith('http'))
            : undefined) ||
          (typeof rawProductCoverValue === 'string' && !isRemoteMediaValue(rawProductCoverValue)
            ? rawProductCoverValue
            : undefined);
        const previewFromBackend = Array.isArray((backendItem as any)?.previewImages)
          ? ((backendItem as any).previewImages as Array<{ url?: string | null; fileId?: string | null }>)
          : [];
        const derivedPreviewImages: Array<{ url?: string; fileId?: string; productName?: string }> = [];
        previewFromBackend.forEach((entry) => {
          const url = typeof entry?.url === 'string' && entry.url.length > 0 ? entry.url : undefined;
          const fileId =
            typeof entry?.fileId === 'string' && entry.fileId.length > 0 ? entry.fileId : undefined;
          if (!url && !fileId) return;
          derivedPreviewImages.push({ url, fileId, productName: (entry as any)?.productName });
        });

        if (derivedPreviewImages.length === 0) {
          const seenPreviewValues = new Set<string>();
          productCandidates.forEach((product: any) => {
            const pName = typeof product?.name === 'string' ? product.name : undefined;
            const thumbnail =
              typeof product?.thumbnail === 'string' && product.thumbnail.length > 0
                ? product.thumbnail
                : undefined;
            const images = Array.isArray(product?.images)
              ? (product.images as unknown[])
                .filter((img) => typeof img === 'string' && img.length > 0)
                .map((img) => img as string)
              : [];
            [thumbnail, ...images].filter(Boolean).forEach((rawValue) => {
              const value = String(rawValue);
              if (seenPreviewValues.has(value)) return;
              seenPreviewValues.add(value);
              if (isRemoteMediaValue(value)) {
                derivedPreviewImages.push({ url: value, productName: pName });
              } else {
                derivedPreviewImages.push({ fileId: value, productName: pName });
              }
            });
          });
        }

        const resolvedCoverImage =
          (backendCoverImageRaw && isRemoteMediaValue(backendCoverImageRaw)
            ? backendCoverImageRaw
            : undefined) ||
          coverImageUrl ||
          productCoverUrl ||
          undefined;
        const coverFileId =
          (backendCoverImageRaw && !isRemoteMediaValue(backendCoverImageRaw)
            ? backendCoverImageRaw
            : undefined) ||
          backendCoverFileId ||
          (typeof fileObj?.id === 'string' ? fileObj.id : undefined) ||
          productCoverFileId;
        const countObj = (backendItem._count as { medias?: number; products?: number } | undefined) ?? undefined;
        const mediaCount = typeof countObj?.medias === 'number' ? countObj!.medias! : ((backendItem.medias as unknown[])?.length || 0);
        const productCount =
          typeof (backendItem as any)?.itemCount === 'number'
            ? ((backendItem as any).itemCount as number)
            : typeof countObj?.products === 'number'
              ? countObj.products
              : productLinks.length;
        // Aggregate total threads/comments: include media-level counts if available
        const baseThreads = (backendItem as any)?.threadsCount as number | undefined;
        const baseComments = (backendItem as any)?.commentsCount as number | undefined;
        const mediaThreadsSum = Array.isArray(medias) ? medias.reduce((sum, m) => sum + (m?.threadsCount || 0), 0) : 0;
        const mediaCommentsSum = Array.isArray(medias) ? medias.reduce((sum, m) => sum + (m?.commentsCount || 0), 0) : 0;
        const totalThreads = (baseThreads || 0) + mediaThreadsSum;
        const totalComments = (baseComments || 0) + mediaCommentsSum;
        const visibility =
          ((backendItem as any).visibility as any) ??
          (backendItem.status === 'PUBLISHED' ? 'PUBLIC' : 'PRIVATE');
        const rawStatus = typeof backendItem.status === 'string' ? backendItem.status.toUpperCase() : '';
        const status =
          rawStatus === 'DRAFT' || rawStatus === 'PUBLISHED' || rawStatus === 'ARCHIVED'
            ? (rawStatus as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED')
            : undefined;

        const rawStoreAvailability = (backendItem as any).isAvailableInStore;
        const isAvailableInStore = rawStoreAvailability === true;
        const resolvedItemCount = isAvailableInStore ? productCount : mediaCount;

        const out = {
          id: backendItem.id as string,
          status,
          name: (backendItem.title as string) || '',
          title: (backendItem.title as string) || '',
          description: (backendItem.description as string) || '',
          ownerId: backendItem.ownerId as string,
          // Public/private derives from Collection.visibility, not publish status
          isPublic: visibility === 'PUBLIC',
          visibility,
          type: (backendItem as any).type as any,
          categoryId: (backendItem.categoryId as string) || undefined,
          subCategoryId:
            ((backendItem as any).subCategoryId as string) ||
            ((backendItem as any).categoryTypeId as string) ||
            undefined,
          categoryTypeId: ((backendItem as any).categoryTypeId as string) || undefined,
          domain:
            (backendItem as any).domain === 'STORE' || (backendItem as any).domain === 'DESIGN'
              ? ((backendItem as any).domain as 'STORE' | 'DESIGN')
              : undefined,
          coverImage: resolvedCoverImage || undefined,
          coverFileId,
          previewImages: derivedPreviewImages.slice(0, 8),
          deletedAt:
            typeof (backendItem as any).deletedAt === 'string'
              ? ((backendItem as any).deletedAt as string)
              : null,
          deleteExpiresAt:
            typeof (backendItem as any).deleteExpiresAt === 'string'
              ? ((backendItem as any).deleteExpiresAt as string)
              : null,
          itemCount: resolvedItemCount,
          postsCount: resolvedItemCount,
          threadsCount: totalThreads,
          commentsCount: totalComments,
          minPrice: (backendItem.minPrice as number) || 0,
          maxPrice: (backendItem.maxPrice as number) || 0,
          // Include sale fields so profile cards reflect active sales
          saleMinPrice: (backendItem as any)?.saleMinPrice ?? null,
          saleMaxPrice: (backendItem as any)?.saleMaxPrice ?? null,
          saleStartAt: (backendItem as any)?.saleStartAt ?? null,
          saleEndAt: (backendItem as any)?.saleEndAt ?? null,
          isAvailableInStore,
          isSystemGenerated: (backendItem as any).isSystemGenerated === true,
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
      const dedupedByCollectionId = new Map<string, CollectionDto>();
      (mapped as CollectionDto[]).forEach((collection) => {
        if (!collection?.id) return;
        const existing = dedupedByCollectionId.get(collection.id);
        if (!existing) {
          dedupedByCollectionId.set(collection.id, collection);
          return;
        }

        const mergedTags = Array.from(
          new Set([...(existing.tags ?? []), ...(collection.tags ?? [])]),
        );

        dedupedByCollectionId.set(collection.id, {
          ...existing,
          ...collection,
          coverImage: existing.coverImage || collection.coverImage || '',
          coverFileId: existing.coverFileId || collection.coverFileId,
          previewImages:
            (Array.isArray((existing as any).previewImages) &&
              (existing as any).previewImages.length > 0
              ? (existing as any).previewImages
              : (collection as any).previewImages) ?? [],
          itemCount: Math.max(existing.itemCount ?? 0, collection.itemCount ?? 0),
          postsCount: Math.max(existing.postsCount ?? 0, collection.postsCount ?? 0),
          threadsCount: Math.max(existing.threadsCount ?? 0, collection.threadsCount ?? 0),
          commentsCount: Math.max(existing.commentsCount ?? 0, collection.commentsCount ?? 0),
          tags: mergedTags,
        });
      });

      const uniqueMapped = Array.from(dedupedByCollectionId.values());


      return uniqueMapped;
    } catch (error) {
      console.error('Error fetching collections:', error);
      return [];
    }
  },

  // Fetch draft collections (PHASE 6)
  async getMyDraftCollections(): Promise<CollectionDto[]> {
    const parseDraftItems = (payload: any): any[] => {
      const items = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.items)
            ? payload.items
            : Array.isArray(payload?.data?.items)
              ? payload.data.items
              : [];
      return Array.isArray(items) ? items : [];
    };

    const mapDrafts = (items: any[]): CollectionDto[] =>
      items.map((item: any) => ({
        id: item.id,
        name: item.title || '',
        title: item.title || '',
        description: item.description || '',
        ownerId: '', // Not returned by draft endpoint, but implied to be current user
        isPublic: false,
        visibility: 'PRIVATE',
        type: 'EVERYBODY', // Default
        domain: 'DESIGN',
        categoryId: '',
        subCategoryId: '',
        categoryTypeId: '',
        coverImage: item.coverImage || '',
        coverFileId: undefined,
        itemCount: item.itemCount || 0,
        postsCount: item.itemCount || 0,
        threadsCount: 0,
        commentsCount: 0,
        minPrice: 0,
        maxPrice: 0,
        saleMinPrice: null,
        saleMaxPrice: null,
        saleStartAt: null,
        saleEndAt: null,
        isAvailableInStore: false,
        createdAt: item.createdAt,
        updatedAt: item.createdAt,
        brandName: '',
        username: '',
        brandLogo: '',
        brandLogoFileId: undefined,
        tags: [],
        // Extra fields for drafts
        pendingCategoryName: item.pendingCategoryName,
        draftReason: item.draftReason,
      }));

    const requestDrafts = async (): Promise<CollectionDto[]> => {
      const response = await apiClient.get('/designs/my/drafts');
      const payload = response.data;
      return mapDrafts(parseDraftItems(payload));
    };

    try {
      return await requestDrafts();
    } catch (error) {
      console.warn('First draft fetch failed, retrying once...', error);
      await new Promise((resolve) => setTimeout(resolve, 800));
      try {
        return await requestDrafts();
      } catch (retryError) {
        console.error('Error fetching draft collections after retry:', retryError);
        throw retryError;
      }
    }
  },

  // Create collection
  async createCollection(data: { name: string; description?: string; isPublic?: boolean; categoryId?: string; subCategoryId?: string; categoryTypeId?: string; type?: 'MALE' | 'FEMALE' | 'EVERYBODY' }): Promise<CollectionDto | null> {
    try {
      const init = await apiClient.post('/designs/initialize', {
        mode: 'existing',
        title: data.name,
        description: data.description,
        visibility: data.isPublic === false ? 'PRIVATE' : 'PUBLIC',
        categoryId: data.categoryId,
        subCategoryId: data.subCategoryId ?? data.categoryTypeId,
        categoryTypeId: data.subCategoryId ?? data.categoryTypeId,
        type: data.type ?? 'EVERYBODY',
      });
      const sessionId = (init.data as any)?.sessionId ?? (init.data as any)?.collectionId ?? (init.data as any)?.id;
      if (!sessionId) return null;

      const finalized = await apiClient.post(`/designs/${sessionId}/finalize`, {
        action: 'draft',
        collectionMetadata: {
          title: data.name,
          description: data.description,
          visibility: data.isPublic === false ? 'PRIVATE' : 'PUBLIC',
          categoryId: data.categoryId,
          subCategoryId: data.subCategoryId ?? data.categoryTypeId,
          categoryTypeId: data.subCategoryId ?? data.categoryTypeId,
          type: data.type ?? 'EVERYBODY',
        },
      });
      return unwrapApiResponse<CollectionDto>(finalized.data as any);
    } catch (error) {
      console.error('Error creating collection:', error);
      return null;
    }
  },

  // =====================
  // Stores (basic CRUD)
  // Frontend helpers for managing brand stores. Backend endpoints may vary.
  // =====================
  async getStores(brandId?: string): Promise<any[]> {
    try {
      const url = brandId ? `/stores?brandId=${encodeURIComponent(brandId)}` : `/stores`;
      const response = await apiClient.get(url);
      const payload = response.data;
      const items = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
      return items;
    } catch (error) {
      console.error('Error fetching stores:', error);
      return [];
    }
  },

  async createStore(data: { name: string; description?: string; website?: string; ownerId?: string }) {
    try {
      const payload = { ...data };
      const response = await apiClient.post('/stores', payload);
      return unwrapApiResponse<any>(response.data);
    } catch (error) {
      console.error('Error creating store:', error);
      return null;
    }
  },

  async updateStore(storeId: string, data: Partial<{ name: string; description?: string; website?: string }>) {
    try {
      const response = await apiClient.patch(`/stores/${storeId}`, data);
      return unwrapApiResponse<any>(response.data);
    } catch (error) {
      console.error('Error updating store:', error);
      return null;
    }
  },

  async deleteStore(storeId: string) {
    try {
      const response = await apiClient.delete(`/stores/${storeId}`);
      return unwrapApiResponse<any>(response.data);
    } catch (error) {
      console.error('Error deleting store:', error);
      return null;
    }
  },

  // Update collection
  async updateCollection(
    collectionId: string,
    data: Partial<CollectionDto>,
    opts?: { scope?: CollectionScope },
  ): Promise<CollectionDto | null> {
    try {
      const basePath = getCollectionBasePath(opts?.scope);
      const response = await apiClient.patch(`${basePath}/${collectionId}`, data);
      return unwrapApiResponse<CollectionDto>(response.data);
    } catch (error) {
      console.error('Error updating collection:', error);
      return null;
    }
  },

  // Delete collection
  async deleteCollection(
    collectionId: string,
    opts?: { scope?: CollectionScope },
  ): Promise<boolean> {
    try {
      const basePath = getCollectionBasePath(opts?.scope);
      await apiClient.delete(`${basePath}/${collectionId}`);
      return true;
    } catch (error) {
      console.error('Error deleting collection:', error);
      return false;
    }
  },

  async restoreCollection(
    collectionId: string,
    opts?: { scope?: CollectionScope },
  ): Promise<boolean> {
    try {
      const basePath = getCollectionBasePath(opts?.scope);
      await apiClient.post(`${basePath}/${collectionId}/restore`, null);
      return true;
    } catch (error) {
      console.error('Error restoring collection:', error);
      return false;
    }
  },

  async permanentlyDeleteCollection(
    collectionId: string,
    opts?: { scope?: CollectionScope },
  ): Promise<boolean> {
    try {
      const basePath = getCollectionBasePath(opts?.scope);
      await apiClient.delete(`${basePath}/${collectionId}/permanent`);
      return true;
    } catch (error) {
      console.error('Error permanently deleting collection:', error);
      return false;
    }
  },

  async archiveCollection(
    collectionId: string,
    opts?: { scope?: CollectionScope },
  ): Promise<boolean> {
    try {
      const basePath = getCollectionBasePath(opts?.scope);
      await apiClient.patch(`${basePath}/${collectionId}/archive`, {});
      return true;
    } catch (error) {
      console.error('Error archiving collection:', error);
      return false;
    }
  },

  async unarchiveCollection(
    collectionId: string,
    opts?: { scope?: CollectionScope },
  ): Promise<boolean> {
    try {
      const basePath = getCollectionBasePath(opts?.scope);
      await apiClient.patch(`${basePath}/${collectionId}/unarchive`, {});
      return true;
    } catch (error) {
      console.error('Error unarchiving collection:', error);
      return false;
    }
  },

  async duplicateCollection(
    collectionId: string,
    opts?: { scope?: CollectionScope },
  ): Promise<CollectionDto | null> {
    try {
      const basePath = getCollectionBasePath(opts?.scope);
      const response = await apiClient.post(`${basePath}/${collectionId}/duplicate`, null);
      return unwrapApiResponse<CollectionDto>(response.data);
    } catch (error) {
      console.error('Error duplicating collection:', error);
      return null;
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
  async getReviews(brandId: string): Promise<{ reviews: ProductReviewResponse[]; averageRating: number; totalReviews: number; ratingDistribution: ReviewRatingDistributionItem[] }> {
    try {
      const data = await reviewsApi.getBrandReviews(brandId, {
        sort: 'newest',
        limit: 20,
      });

      const totalReviews = data.summary.totalReviews || 0;

      return {
        reviews: Array.isArray(data.items) ? data.items : [],
        averageRating: data.summary.averageRating || 0,
        totalReviews,
        ratingDistribution: mapRatingDistribution(data.summary.ratingBreakdown, totalReviews),
      };
    } catch (error) {
      console.error('Error fetching reviews:', error);
      return { reviews: [], averageRating: 0, totalReviews: 0, ratingDistribution: [] };
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

  /**
   * Resolve a raw unsigned S3 URL into a signed/accessible URL.
   * Extracts the S3 key from the URL and calls the public-url-by-key endpoint.
   * Falls back to returning the original URL if signing fails.
   */
  async getSignedS3Url(rawS3Url: string): Promise<string | null> {
    if (!rawS3Url || typeof rawS3Url !== 'string') return null;

    // Check cache using the raw URL as key
    const existing = signedUrlCache.get(rawS3Url);
    if (existing && existing.expiresAt > Date.now()) {
      return existing.url;
    }

    const inflight = signedUrlPending.get(rawS3Url);
    if (inflight) return inflight;

    const request = (async (): Promise<string | null> => {
      try {
        // Extract the S3 key from the URL (path after the bucket hostname)
        const parsed = new URL(rawS3Url);
        const s3Key = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
        if (!s3Key) return rawS3Url;

        // Use the key-based signing endpoint (query param, not path param)
        const response = await apiClient.get('/uploads/public-url-by-key', {
          params: { key: s3Key },
        });
        const payload = unwrapApiResponse<{ url?: string }>(response.data);
        const signedUrl =
          (payload as { url?: string })?.url ??
          (response.data as { url?: string })?.url ??
          null;
        if (typeof signedUrl === 'string' && signedUrl.length > 0) {
          signedUrlCache.set(rawS3Url, {
            url: signedUrl,
            expiresAt: Date.now() + SIGNED_URL_TTL_MS,
          });
          return signedUrl;
        }
        // Fall back to raw URL
        return rawS3Url;
      } catch {
        // If signing fails, return the original raw URL as a best-effort fallback
        return rawS3Url;
      } finally {
        signedUrlPending.delete(rawS3Url);
      }
    })();

    signedUrlPending.set(rawS3Url, request);
    return request;
  },

  async getSignedS3KeyUrl(s3Key: string): Promise<string | null> {
    const normalizedKey = String(s3Key ?? '').trim().replace(/^\/+/, '');
    if (!normalizedKey) return null;

    const existing = signedUrlCache.get(normalizedKey);
    if (existing && existing.expiresAt > Date.now()) {
      return existing.url;
    }

    const inflight = signedUrlPending.get(normalizedKey);
    if (inflight) return inflight;

    const request = (async (): Promise<string | null> => {
      try {
        const response = await apiClient.get('/uploads/public-url-by-key', {
          params: { key: normalizedKey },
        });
        const payload = unwrapApiResponse<{ url?: string }>(response.data);
        const signedUrl =
          (payload as { url?: string })?.url ??
          (response.data as { url?: string })?.url ??
          null;
        if (typeof signedUrl === 'string' && signedUrl.length > 0) {
          signedUrlCache.set(normalizedKey, {
            url: signedUrl,
            expiresAt: Date.now() + SIGNED_URL_TTL_MS,
          });
          return signedUrl;
        }
        return null;
      } catch {
        return null;
      } finally {
        signedUrlPending.delete(normalizedKey);
      }
    })();

    signedUrlPending.set(normalizedKey, request);
    return request;
  },
  // Get one collection with medias
  async getCollectionDetail(
    collectionId: string,
    opts?: { scope?: CollectionScope },
  ): Promise<any> {
    try {
      const basePath = getCollectionBasePath(opts?.scope);
      const response = await apiClient.get(`${basePath}/${collectionId}`, {
        params: { _cb: Date.now() },
        headers: {
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
      });
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

  // ============================================
  // BRAND PATCHES
  // ============================================

  async getBrandPatches(brandId: string, status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'REVOKED' = 'ACCEPTED', page = 1, limit = 20) {
    try {
      const response = await apiClient.get(`/brands/${brandId}/patches`, {
        params: { status, page, limit },
      });
      return unwrapApiResponse<{ items: any[]; total: number; page: number; totalPages: number }>(response.data);
    } catch (error) {
      console.error('Error fetching brand patches:', error);
      return { items: [], total: 0, page: 1, totalPages: 1 };
    }
  },

  async requestBrandPatch(targetBrandId: string) {
    const response = await apiClient.post(`/brands/patches/request`, { targetBrandId });
    return unwrapApiResponse<{ status: string; message: string }>(response.data);
  },

  async respondToBrandPatch(patchId: string, action: 'ACCEPTED' | 'REJECTED') {
    const response = await apiClient.patch(`/brands/patches/${patchId}/respond`, { status: action });
    return unwrapApiResponse<{ status: string; message: string }>(response.data);
  },

  async cancelBrandPatch(patchId: string) {
    // Assuming cancel is just a status update or delete. Using DELETE for now if API supports it, or PATCH to REVOKED/CANCELLED
    // Based on backend service, there isn't a specific 'cancel' endpoint exposed in the snippet, 
    // but usually it's a status update. If not implemented, we might need to add it to backend.
    // For now, let's assume we can use respond with REJECTED or a specific cancel endpoint if it existed.
    // Wait, the backend service `respondToBrandPatch` checks if `patch.receiverId === responderId`.
    // The requester cannot use `respondToBrandPatch`.
    // We need a `cancelPatchRequest` endpoint in backend? 
    // The backend service snippet didn't show a `cancel` method for requester.
    // I will add a placeholder here, but note that backend might need update if not present.
    // Actually, let's check `brands.controller.ts` if I could... but I don't have it.
    // I'll assume a DELETE endpoint for now as per REST conventions for cancelling pending resources.
    const response = await apiClient.delete(`/brands/patches/${patchId}`);
    return unwrapApiResponse<{ message: string }>(response.data);
  },

  // ============================================
  // DASHBOARD
  // ============================================

  async getDashboardOverview(brandId: string) {
    try {
      const response = await apiClient.get(`/brands/${brandId}/dashboard/overview`);
      return unwrapApiResponse<any>(response.data);
    } catch (error) {
      console.error('Error fetching dashboard overview:', error);
      return null;
    }
  },

  async getDashboardAnalytics(brandId: string, range: '7d' | '30d' | 'ytd' = '30d') {
    try {
      const response = await apiClient.get(`/brands/${brandId}/dashboard/analytics?range=${range}`);
      return unwrapApiResponse<any>(response.data);
    } catch (error) {
      console.error('Error fetching dashboard analytics:', error);
      return null;
    }
  },

  // ============================================
  // ORDERS
  // ============================================

  async getOrders(brandId: string, params?: { page?: number; limit?: number; status?: string; q?: string }) {
    try {
      const query = new URLSearchParams();
      if (params?.page) query.append('page', String(params.page));
      if (params?.limit) query.append('limit', String(params.limit));
      if (params?.status) query.append('status', params.status);
      if (params?.q) query.append('q', params.q);

      const response = await apiClient.get(`/brands/${brandId}/orders?${query.toString()}`);
      return unwrapApiResponse<any>(response.data);
    } catch (error) {
      console.error('Error fetching orders:', error);
      return null;
    }
  },

  async getOrderDetail(brandId: string, orderId: string) {
    try {
      const response = await apiClient.get(`/brands/${brandId}/orders/${orderId}`);
      return unwrapApiResponse<any>(response.data);
    } catch (error) {
      console.error('Error fetching order detail:', error);
      return null;
    }
  },

  async updateOrderStatus(brandId: string, orderId: string, status: string) {
    try {
      const response = await apiClient.patch(`/brands/${brandId}/orders/${orderId}/status`, { status });
      return unwrapApiResponse<any>(response.data);
    } catch (error) {
      console.error('Error updating order status:', error);
      return null;
    }
  },

  // ============================================
  // PAYOUTS
  // ============================================

  async getPayouts(brandId: string) {
    try {
      const response = await apiClient.get(`/brands/${brandId}/payouts`);
      return unwrapApiResponse<any>(response.data);
    } catch (error) {
      console.error('Error fetching payouts:', error);
      return null;
    }
  },

  async requestPayout(brandId: string, amount: number) {
    try {
      const response = await apiClient.post(`/brands/${brandId}/payouts/request`, { amount });
      return unwrapApiResponse<any>(response.data);
    } catch (error) {
      console.error('Error requesting payout:', error);
      throw error; // Re-throw to handle in UI
    }
  },
};

const extractApiErrorMessage = (error: unknown): string | null => {
  if (isAxiosError(error)) {
    const data = error.response?.data as {
      message?: unknown;
      errors?: Array<{ messages?: unknown; constraints?: unknown }>;
    } | undefined;

    if (data?.errors && data.errors.length > 0) {
      const first = data.errors[0];
      const messages =
        (Array.isArray(first.messages) && first.messages) ||
        (Array.isArray(first.constraints) && first.constraints) ||
        [];
      if (messages.length > 0) {
        return String(messages[0]);
      }
    }

    if (typeof data?.message === 'string' && data.message.length > 0) {
      return data.message;
    }

    if (Array.isArray(data?.message) && data.message.length > 0) {
      return String(data.message[0]);
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return null;
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


