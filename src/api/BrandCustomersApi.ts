import { apiClient } from "./httpClient";
import { unwrapApiResponse } from "@/types/auth";

export interface BrandCommerceAccess {
  tierKey: string;
  canUpgrade: boolean;
  canConfigureCustomers: boolean;
  customerMinimumOrders: number;
  effectiveMinimumOrders: number;
}
export interface BrandCustomerPage {
  items: Array<{
    id: string;
    name: string;
    username: string | null;
    orderCount: number;
    lastOrderAt: string;
  }>;
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
  settings: BrandCommerceAccess;
}
export const brandCustomersApi = {
  access: async (id: string, signal?: AbortSignal) =>
    unwrapApiResponse<BrandCommerceAccess>(
      (await apiClient.get(`/brands/${id}/customer-settings`, { signal })).data,
    ),
  update: async (id: string, minimumOrders: number) =>
    unwrapApiResponse<BrandCommerceAccess>(
      (
        await apiClient.patch(`/brands/${id}/customer-settings`, {
          minimumOrders,
        })
      ).data,
    ),
  list: async (
    id: string,
    params: { page: number; search?: string },
    signal?: AbortSignal,
  ) =>
    unwrapApiResponse<BrandCustomerPage>(
      (await apiClient.get(`/brands/${id}/customers`, { params, signal })).data,
    ),
};
