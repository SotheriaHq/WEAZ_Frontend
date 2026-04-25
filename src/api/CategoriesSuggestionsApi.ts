// Category Suggestions feature is removed. This file remains as a no-op shim
// to avoid import errors if any legacy code references it.
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

export async function submitCategorySuggestion(): Promise<never> {
  throw new Error('Category suggestions are disabled');
}
export async function listMyCategorySuggestions(): Promise<CategorySuggestionDto[]> {
  return [];
}
export async function adminListCategorySuggestions(): Promise<CategorySuggestionDto[]> {
  return [];
}
export async function adminModerateCategorySuggestion(): Promise<never> {
  throw new Error('Category suggestions are disabled');
}
