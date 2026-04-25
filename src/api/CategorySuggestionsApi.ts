// Legacy client removed. Keep a tiny stub to avoid import churn.
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
  async getAll(): Promise<CategorySuggestionDto[]> { return []; },
  async submit(): Promise<never> { throw new Error('Category suggestions are disabled'); },
  async moderate(): Promise<never> { throw new Error('Category suggestions are disabled'); },
};
