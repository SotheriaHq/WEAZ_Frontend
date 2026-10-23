import { apiClient } from "./httpClient";
import { unwrapApiResponse } from "@/types/auth";

export async function getStudioProductsPage<T>(
  id: string,
  params: Record<string, unknown>,
  signal?: AbortSignal,
) {
  const response = await apiClient.get(`/brands/${id}/products`, {
    params,
    signal,
  });
  const page = unwrapApiResponse<{
    items?: T[];
    total?: number;
    nextCursor?: string | null;
  }>(response.data);
  const items = Array.isArray(page?.items) ? page.items : [];
  return {
    items,
    total: typeof page?.total === "number" ? page.total : items.length,
    nextCursor: page?.nextCursor ?? null,
  };
}
