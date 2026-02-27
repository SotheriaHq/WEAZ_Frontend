export type MarketMediaType = 'POST_IMAGE' | 'POST_VIDEO' | string;

export interface MarketMedia {
  fileId: string;
  url?: string | null;
  previewUrl?: string | null;
  type: MarketMediaType;
  aspectRatio?: number | null;
  createdAt?: string | null;
}

export interface MarketItem {
  id: string;
  collectionId: string;
  coverMediaId?: string | null;
  collectionTitle: string;
  collectionDescription?: string | null;
  brandId: string;
  brandName?: string | null;
  username?: string | null;
  brandLogo?: string | null;
  brandLogoFileId?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  // Optional sale fields from backend when a sale is active or specified
  saleMinPrice?: number | null;
  saleMaxPrice?: number | null;
  saleStartAt?: string | null;
  saleEndAt?: string | null;
  threadsCount?: number | null;
  commentsCount?: number | null;
  // When requested with counts=combined, backend may supply combined total
  combinedCommentsCount?: number | null;
  collectionCollabCount?: number | null;
  tags: string[];
  media: MarketMedia;
  isThreaded?: boolean; // Backend includes this for authenticated users
}

export interface MarketFeedResponse {
  items: MarketItem[];
  hasNextPage: boolean;
  nextCursor?: string | null;
}
