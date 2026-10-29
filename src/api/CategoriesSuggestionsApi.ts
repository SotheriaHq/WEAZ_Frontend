import { apiClient } from './httpClient';
import { unwrapApiResponse } from '@/types/auth';

export type CategorySuggestionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export interface CategorySuggestionDto {
  id: string;
  name: string;
  slug: string;
  garmentTypeName?: string | null;
  garmentTypeSlug?: string;
  description?: string | null;
  status: CategorySuggestionStatus;
  rejectionReason?: string | null;
  approvedCategoryId?: string | null;
  approvedCategoryTypeId?: string | null;
  proposedByUserId: string;
  decisionByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
  decidedAt?: string | null;
}
export async function submitCategorySuggestion(input: { name: string; garmentTypeName?: string; description: string }): Promise<CategorySuggestionDto> {
  return unwrapApiResponse<CategorySuggestionDto>((await apiClient.post('/categories/suggestions', input)).data);
}
export type CategorySuggestionPage = { items: CategorySuggestionDto[]; nextCursor: string | null };
export async function listMyCategorySuggestions(cursor?: string, signal?: AbortSignal): Promise<CategorySuggestionPage> {
  return unwrapApiResponse<CategorySuggestionPage>((await apiClient.get('/categories/suggestions/mine', { params: { cursor, limit: 25 }, signal })).data);
}
