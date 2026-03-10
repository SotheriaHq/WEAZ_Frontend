import { apiClient } from './httpClient';
import { unwrapApiResponse } from '@/types/auth';
import type {
  SearchRequestParams,
  SearchResponse,
  SearchSuggestionResponse,
} from '@/types/search';

export const SearchApi = {
  async suggest(params: { q?: string; brandId?: string }, signal?: AbortSignal) {
    const response = await apiClient.get<SearchSuggestionResponse>('/v1/search/suggest', {
      params,
      signal,
    });
    return unwrapApiResponse<SearchSuggestionResponse>(response.data as any);
  },

  async search(params: SearchRequestParams, signal?: AbortSignal) {
    const response = await apiClient.get<SearchResponse>('/v1/search', {
      params,
      signal,
    });
    return unwrapApiResponse<SearchResponse>(response.data as any);
  },
};

export default SearchApi;