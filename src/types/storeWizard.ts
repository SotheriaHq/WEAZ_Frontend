export type DomainVerificationStatus = 'optional' | 'pending' | 'verified' | 'failed';

export type WizardCollectionType = 'standard' | 'seasonal' | 'limited' | 'capsule';
export type WizardCollectionStatus = 'active' | 'inactive';

export interface WizardProduct {
  id: string;
  name: string;
  price: number;
  image: string;
  // Allow extra fields without constantly updating this type during iteration.
  [key: string]: unknown;
}

export interface WizardCollection {
  id: string;
  name: string;
  description?: string;
  coverImage: string;
  type: WizardCollectionType | 'standard';
  productIds: string[];
  featured: boolean;
  status: WizardCollectionStatus;
  launchDate?: string;
  quantityCap?: number;
  notifyFollowers?: boolean;
  showCountdown?: boolean;
  [key: string]: unknown;
}

export interface WizardLookHotspot {
  x: number;
  y: number;
  productId: string;
}

export interface WizardLook {
  id: string;
  name: string;
  description?: string;
  image: string;
  styledBy: string;
  productIds: string[];
  hotspots: WizardLookHotspot[];
  featured: boolean;
  allowSizeSwap: boolean;
  discount: number;
  [key: string]: unknown;
}

export type MediaIssueType = 'resolution' | 'composition' | 'quality' | 'watermark' | string;

export interface MediaIssue {
  type: MediaIssueType;
  message: string;
}

export type MediaStatus = 'passed' | 'warning' | 'failed';

export interface MediaItem {
  id: string;
  url: string;
  name: string;
  resolution: string;
  status: MediaStatus;
  issues?: MediaIssue[];
  [key: string]: unknown;
}

export interface StoreWizardData {
  // Step 1
  name: string;
  slug: string;
  categories: string[];
  tagline: string;
  description: string;

  // Optional previews (UI only)
  logoPreview?: string | null;
  bannerPreview?: string | null;

  // Step 2
  instagram: string;
  tiktok: string;
  twitter: string;
  website: string;
  tags: string[];
  domainVerificationStatus: DomainVerificationStatus;

  // Step 3
  shippingRegions: string[];
  processingTime: string;
  shippingMethods: string[];
  freeShippingThreshold: number | null;
  shippingMethod: string;
  shippingRates: unknown[];
  returnsAccepted: boolean;
  returnWindow: string;
  returnConditions: string[];
  refundMethod: string;
  sizeChartFile: File | null;
  sizeChartUrl: string | null;
  sizeChartPresetKey: string | null;
  sizeChartSystem: string | null;
  responseTimeSla: string;
  contactEmail: string;

  // Step 4
  products: WizardProduct[];
  collections: WizardCollection[];
  looks: WizardLook[];
  catalogActiveTab: 'collections' | 'looks';

  // Step 5
  mediaItems: MediaItem[];
  termsAccepted: boolean;
}
