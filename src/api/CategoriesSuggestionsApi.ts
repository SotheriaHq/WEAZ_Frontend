import { apiClient } from './httpClient';
import { unwrapApiResponse } from '../types/auth';

export type CategorySuggestionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface CategorySuggestionDto {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  status: CategorySuggestionStatus;
  rejectionReason?: string | null;
  approvedCategoryId?: string | null;
  proposedByUserId: string;
  decisionByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
  decidedAt?: string | null;
}

export async function submitCategorySuggestion(input: { name: string; description?: string }) {
  const res = await apiClient.post('/categories/suggestions', input);
  return unwrapApiResponse<CategorySuggestionDto>(res.data);
}

export async function listMyCategorySuggestions() {
  const res = await apiClient.get('/categories/suggestions/mine');
  return unwrapApiResponse<CategorySuggestionDto[]>(res.data);
}

export async function adminListCategorySuggestions(status?: CategorySuggestionStatus) {
  const res = await apiClient.get('/admin/categories/suggestions', { params: { status } });
  return unwrapApiResponse<CategorySuggestionDto[]>(res.data);
}

export async function adminModerateCategorySuggestion(id: string, decision: 'APPROVE' | 'REJECT', rejectionReason?: string) {
  const res = await apiClient.patch(`/admin/categories/suggestions/${id}`, { decision, rejectionReason });
  return unwrapApiResponse<CategorySuggestionDto>(res.data);
}
