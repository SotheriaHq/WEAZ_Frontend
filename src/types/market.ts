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
  collectionTitle: string;
  collectionDescription?: string | null;
  brandId: string;
  brandName?: string | null;
  username?: string | null;
  brandLogo?: string | null;
  brandLogoFileId?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  likesCount?: number | null;
  commentsCount?: number | null;
  patchesCount?: number | null;
  tags: string[];
  media: MarketMedia;
}

export interface MarketFeedResponse {
  items: MarketItem[];
  hasNextPage: boolean;
  nextCursor?: string | null;
}
