import { apiClient } from './httpClient';
import { createIdempotencyKey } from './idempotency';

// =====================
// Types
// =====================

export interface ProductVariant {
    id?: string;
    size?: string;
    color?: string;
    colorHex?: string;
    sku?: string;
    price?: number;
    stock: number;
    lowStock?: boolean;
}

function buildStoreProductPayload(data: Partial<ProductCreateDto>) {
    const payload: any = {};

    // Backend expects: collectionId, name, price, salePrice, sizes, sizeStock, colors, images, thumbnail,
    // totalStock, lowStockThreshold, tags, gender, isActive, isFeatured

    if (data.title !== undefined) payload.name = data.title;
    if (data.description !== undefined) payload.description = data.description;
    if (data.currency !== undefined) payload.currency = data.currency;
    if (data.categoryId !== undefined) payload.collectionId = data.categoryId;
    if (data.price !== undefined) payload.price = data.price;

    // Frontend uses compareAtPrice+onSale; backend uses salePrice.
    // Use compareAtPrice as salePrice when supplied (best-effort compatibility).
    if (data.compareAtPrice !== undefined) payload.salePrice = data.compareAtPrice;

    if (Array.isArray(data.tags)) payload.tags = data.tags;

    // Extra metadata fields now supported by backend
    if (data.sku !== undefined) payload.sku = data.sku;
    if (data.weight !== undefined) payload.weight = data.weight;
    if (data.weightUnit !== undefined) payload.weightUnit = data.weightUnit;
    if (data.materials !== undefined) payload.materials = data.materials;
    if (data.careInstructions !== undefined) payload.careInstructions = data.careInstructions;
    if (data.costPerItem !== undefined) payload.costPerItem = data.costPerItem;
    if (data.returnsEligible !== undefined) payload.returnsEligible = data.returnsEligible;
    if (data.trackInventory !== undefined) payload.trackInventory = data.trackInventory;
    if (data.allowBackorders !== undefined) payload.allowBackorders = data.allowBackorders;
    if (data.isPhysicalProduct !== undefined) payload.isPhysicalProduct = data.isPhysicalProduct;
    if (data.customsRegion !== undefined) payload.customsRegion = data.customsRegion;
    if (data.metaTitle !== undefined) payload.metaTitle = data.metaTitle;
    if (data.metaDescription !== undefined) payload.metaDescription = data.metaDescription;
    if ((data as any).publishAt !== undefined) payload.publishAt = (data as any).publishAt;

    // Variants mapping (store schema uses arrays + sizeStock map)
    if (Array.isArray(data.variants) && data.variants.length > 0) {
        payload.variants = data.variants.map((v) => ({
            size: v.size,
            color: v.color,
            colorHex: v.colorHex,
            sku: v.sku,
            price: v.price,
            stock: v.stock,
        }));

        const sizeSet = new Set<string>();
        const colorSet = new Set<string>();
        const sizeStock: Record<string, number> = {};
        const colorHexCodes: Record<string, string> = {};
        let totalStock = 0;

        for (const v of data.variants) {
            if (v.size) {
                const s = String(v.size).trim();
                if (s) {
                    sizeSet.add(s);
                    sizeStock[s] = (sizeStock[s] ?? 0) + (Number(v.stock) || 0);
                }
            }
            if (v.color) {
                const c = String(v.color).trim();
                if (c) {
                    colorSet.add(c);
                    if (v.colorHex) {
                        const hex = String(v.colorHex).trim();
                        if (hex) colorHexCodes[c] = hex;
                    }
                }
            }
            totalStock += Number(v.stock) || 0;
        }

        payload.sizes = Array.from(sizeSet);
        payload.colors = Array.from(colorSet);
        payload.sizeStock = sizeStock;
        payload.totalStock = totalStock;
        if (Object.keys(colorHexCodes).length > 0) {
            payload.colorHexCodes = colorHexCodes;
        }
    } else {
        // No variants: best-effort stock mapping
        if (data.stock !== undefined) payload.totalStock = data.stock;
    }

    if (data.lowStockThreshold !== undefined) payload.lowStockThreshold = data.lowStockThreshold;

    // Keep any images/thumbnail if caller provided them (edit mode)
    if ((data as any).images !== undefined) payload.images = (data as any).images;
    if ((data as any).thumbnail !== undefined) payload.thumbnail = (data as any).thumbnail;

    // Status mapping
    if (data.status !== undefined) payload.isActive = data.status === 'ACTIVE';

    return payload;
}

export interface ProductCreateDto {
    title: string;
    description?: string;
    categoryId?: string;
    tags?: string[];
    price: number;
    compareAtPrice?: number;
    costPerItem?: number;
    currency?: string;
    sku?: string;
    weight?: number;
    weightUnit?: 'kg' | 'lb';
    materials?: string;
    careInstructions?: string;
    returnsEligible?: boolean;
    sustainabilityClaim?: boolean;
    trackInventory?: boolean;
    allowBackorders?: boolean;
    stock?: number;
    lowStockThreshold?: number;
    status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    mediaIds?: string[];
    variants?: ProductVariant[];
    isPhysicalProduct?: boolean;
    customsRegion?: string;
    metaTitle?: string;
    metaDescription?: string;
    publishAt?: string;
}

export interface ProductDto {
    id: string;
    title: string;
    name?: string; // Alias for title
    description?: string;
    categoryId?: string;
    category?: { id: string; name: string; slug: string };
    tags?: string[];
    price: number;
    compareAtPrice?: number;
    costPerItem?: number;
    currency: string;
    sku?: string;
    weight?: number;
    weightUnit?: 'kg' | 'lb';
    materials?: string;
    careInstructions?: string;
    returnsEligible?: boolean;
    sustainabilityClaim?: boolean;
    trackInventory?: boolean;
    allowBackorders?: boolean;
    stock?: number;
    totalStock?: number;
    lowStockThreshold?: number;
    status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    metaTitle?: string;
    metaDescription?: string;
    publishAt?: string;
    images?: string[];
    thumbnail?: string;
    mediaIds?: string[];
    media?: Array<{ id: string; url: string; type: string; isPrimary?: boolean }>;
    variants?: ProductVariant[];
    isPhysicalProduct?: boolean;
    customsRegion?: string;
    isFeatured?: boolean;
    isOutOfStock?: boolean;
    isLowStock?: boolean;
    viewsCount?: number;
    likesCount?: number;
    effectivePrice?: number;
    createdAt?: string;
    updatedAt?: string;
    brandId?: string;
    brand?: {
        id: string;
        name: string;
        currency?: string;
    };
}

export interface Category {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    parentId?: string | null;
    children?: Category[];
}

export interface ProductListResponse {
    items: ProductDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
}

// =====================
// Product API
// =====================

export const productApi = {
    /**
     * Get a single product by ID
     */
    async getProduct(productId: string): Promise<ProductDto | null> {
        try {
            const response = await apiClient.get<{ status: string; data: ProductDto }>(`/products/${productId}`);
            return response.data?.data ?? response.data as unknown as ProductDto ?? null;
        } catch (error) {
            console.error('Failed to fetch product', error);
            throw error;
        }
    },

    /**
     * Create a new product
     */
    async createProduct(data: ProductCreateDto): Promise<ProductDto> {
        try {
            const payload = buildStoreProductPayload(data);
            const response = await apiClient.post<{ status: string; data: ProductDto }>('/products', payload, {
                headers: { 'Idempotency-Key': createIdempotencyKey() },
            });
            return response.data?.data ?? response.data as unknown as ProductDto;
        } catch (error) {
            console.error('Failed to create product', error);
            throw error;
        }
    },

    /**
     * Update an existing product
     */
    async updateProduct(productId: string, data: Partial<ProductCreateDto>): Promise<ProductDto> {
        try {
            const payload = buildStoreProductPayload(data);
            const response = await apiClient.patch<{ status: string; data: ProductDto }>(`/products/${productId}`, payload);
            return response.data?.data ?? response.data as unknown as ProductDto;
        } catch (error) {
            console.error('Failed to update product', error);
            throw error;
        }
    },

    /**
     * Delete a product
     */
    async deleteProduct(productId: string): Promise<void> {
        try {
            await apiClient.delete(`/products/${productId}`);
        } catch (error) {
            console.error('Failed to delete product', error);
            throw error;
        }
    },

    /**
     * Archive a product (soft delete)
     */
    async archiveProduct(productId: string): Promise<ProductDto> {
        return this.updateProduct(productId, { status: 'ARCHIVED' });
    },

    /**
     * Duplicate a product
     */
    async duplicateProduct(productId: string): Promise<ProductDto> {
        try {
            const response = await apiClient.post<{ status: string; data: ProductDto }>(`/products/${productId}/duplicate`);
            return response.data?.data ?? response.data as unknown as ProductDto;
        } catch (error) {
            console.error('Failed to duplicate product', error);
            throw error;
        }
    },

    /**
     * Get products for a brand
     */
    async getBrandProducts(
        brandId: string,
        params?: {
            page?: number;
            limit?: number;
            sortBy?: string;
            status?: string;
            search?: string;
            categoryId?: string;
        }
    ): Promise<ProductListResponse> {
        try {
            const response = await apiClient.get<Partial<ProductListResponse>>(`/brands/${brandId}/products`, { params });
            const items = Array.isArray(response.data?.items) ? response.data.items : [];
            return {
                items,
                total: response.data?.total ?? items.length,
                page: response.data?.page ?? 1,
                limit: response.data?.limit ?? 20,
                totalPages: response.data?.totalPages ?? 1,
                hasNextPage: response.data?.hasNextPage ?? false,
            };
        } catch (error) {
            console.error('Failed to fetch brand products', error);
            throw error;
        }
    },

    /**
     * Get product categories
     */
    async getCategories(): Promise<Category[]> {
        try {
            // Backend source of truth is collection categories; expose via /collections/categories.
            const response = await apiClient.get<Category[]>('/collections/categories');
            return (response.data as any)?.data ?? response.data as unknown as Category[] ?? [];
        } catch (error) {
            console.error('Failed to fetch categories', error);
            // Return default categories as fallback
            return [
                { id: 'tshirts', name: 'T-Shirts', slug: 'tshirts' },
                { id: 'hoodies', name: 'Hoodies', slug: 'hoodies' },
                { id: 'dresses', name: 'Dresses', slug: 'dresses' },
                { id: 'pants', name: 'Pants', slug: 'pants' },
                { id: 'accessories', name: 'Accessories', slug: 'accessories' },
                { id: 'shoes', name: 'Shoes', slug: 'shoes' },
                { id: 'bags', name: 'Bags', slug: 'bags' },
            ];
        }
    },

    /**
     * Upload product media
     */
    async uploadProductMedia(
        productId: string,
        file: File,
        isPrimary = false
    ): Promise<{ id: string; url: string }> {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('isPrimary', String(isPrimary));

            const response = await apiClient.post<{ status: string; data: { id: string; url: string } }>(
                `/products/${productId}/media`,
                formData,
                {
                    headers: { 'Content-Type': 'multipart/form-data' },
                }
            );
            return response.data?.data ?? response.data as unknown as { id: string; url: string };
        } catch (error) {
            console.error('Failed to upload product media', error);
            throw error;
        }
    },

    /**
     * Delete product media
     */
    async deleteProductMedia(productId: string, mediaId: string): Promise<void> {
        try {
            await apiClient.delete(`/products/${productId}/media/${mediaId}`);
        } catch (error) {
            console.error('Failed to delete product media', error);
            throw error;
        }
    },

    /**
     * Reorder product media
     */
    async reorderProductMedia(productId: string, mediaIds: string[]): Promise<void> {
        try {
            await apiClient.patch(`/products/${productId}/media/reorder`, { mediaIds });
        } catch (error) {
            console.error('Failed to reorder product media', error);
            throw error;
        }
    },

    /**
     * Set primary media for product
     */
    async setPrimaryMedia(productId: string, mediaId: string): Promise<void> {
        try {
            await apiClient.patch(`/products/${productId}/media/${mediaId}/primary`);
        } catch (error) {
            console.error('Failed to set primary media', error);
            throw error;
        }
    },
};

export default productApi;
