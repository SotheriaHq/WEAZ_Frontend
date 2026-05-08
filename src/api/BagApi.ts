import { apiClient } from './httpClient';
import { unwrapApiResponse, type ApiSuccessPayload } from '@/types/auth';
import type { BagStatus, CartItem } from './StoreApi';
import type {
  CustomOrderCheckoutBagLine,
  CustomOrderCheckoutBagResponse,
} from './CustomOrderApi';
import type { SizingMode } from '@/types/sizing';

export type BagSourceType = 'PRODUCT' | 'DESIGN' | 'COLLECTION';

export interface BagCount {
  standardQuantity: number;
  customLineCount: number;
  combinedCount: number;
}

export type StandardBagPayload = {
  productId: string;
  quantity?: number;
  selectedSize?: string;
  selectedColor?: string;
  sizingMode?: SizingMode;
  requiredMeasurementKeys?: string[];
  sizeFitData?: Record<string, unknown>;
};

export type StandardBag = {
  items: CartItem[];
  subtotal: number;
  itemCount: number;
  totalQuantity?: number;
};

const unwrap = <T>(data: unknown): T => unwrapApiResponse<T>(data as ApiSuccessPayload<T>);

export const BagApi = {
  async getBagCount(): Promise<BagCount> {
    const response = await apiClient.get('/bag/count');
    return unwrap<BagCount>(response.data);
  },

  async getProductBagStatus(productId: string): Promise<BagStatus> {
    const response = await apiClient.get(`/store/products/${productId}/bag-status`);
    return unwrap<BagStatus>(response.data);
  },

  async getSourceBagStatus(sourceType: BagSourceType, sourceId: string): Promise<BagStatus> {
    const response = await apiClient.get(`/bag/sources/${sourceType}/${sourceId}/status`);
    return unwrap<BagStatus>(response.data);
  },

  async addStandardToBag(payload: StandardBagPayload): Promise<StandardBag> {
    const response = await apiClient.post('/store/cart', payload);
    return unwrap<StandardBag>(response.data);
  },

  async getStandardBag(): Promise<StandardBag> {
    const response = await apiClient.get('/store/cart');
    return unwrap<StandardBag>(response.data);
  },

  async updateStandardBagItem(itemId: string, payload: { quantity: number }): Promise<StandardBag> {
    const response = await apiClient.patch(`/store/cart/${itemId}`, payload);
    return unwrap<StandardBag>(response.data);
  },

  async removeStandardBagItem(itemId: string): Promise<StandardBag> {
    const response = await apiClient.delete(`/store/cart/${itemId}`);
    return unwrap<StandardBag>(response.data);
  },

  async getCustomBag(): Promise<CustomOrderCheckoutBagResponse> {
    const response = await apiClient.get('/custom-orders/checkout-bag');
    return unwrap<CustomOrderCheckoutBagResponse>(response.data);
  },

  async removeCustomBagLine(sessionId: string): Promise<{ removed: boolean }> {
    const response = await apiClient.delete(`/custom-orders/checkout-sessions/${sessionId}`);
    return unwrap<{ removed: boolean }>(response.data);
  },
};

export type { BagStatus, CartItem, CustomOrderCheckoutBagLine, CustomOrderCheckoutBagResponse };

export default BagApi;
