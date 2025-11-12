/**
 * PHASE 5: Category Suggestions API Client
 */
import { apiClient } from '@/api/httpClient';

export interface CategorySuggestionDto {
  id: string;
  name: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  proposedBy: string;
  proposerId: string;
  proposerUsername?: string;
  decidedBy?: string;
  decidedByUsername?: string;
  reason?: string;
  createdAt: string;
  updatedAt: string;
}

export const CategorySuggestionsApi = {
  /**
   * Get all category suggestions (admin only)
   */
  async getAll(): Promise<CategorySuggestionDto[]> {
    const response = await apiClient.get('/collections/categories/suggestions');
    return response.data;
  },

  /**
   * Submit a new category suggestion
   */
  async submit(name: string): Promise<CategorySuggestionDto> {
    const response = await apiClient.post('/collections/categories/suggest', { name });
    return response.data;
  },

  /**
   * Moderate a category suggestion (approve/reject)
   */
  async moderate(
    id: string,
    status: 'APPROVED' | 'REJECTED',
    reason?: string
  ): Promise<CategorySuggestionDto> {
    const response = await apiClient.patch(`/collections/categories/suggestions/${id}`, {
      status,
      reason,
    });
    return response.data;
  },
};
