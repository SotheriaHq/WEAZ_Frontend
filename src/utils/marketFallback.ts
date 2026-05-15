export type MarketPageMode = 'designs' | 'market';

interface ProductFallbackContext {
  mode: MarketPageMode;
  selectedCategory: string;
  designItemCount: number;
}

export const shouldLoadProductFallback = ({
  mode,
  selectedCategory,
  designItemCount,
}: ProductFallbackContext): boolean =>
  mode === 'market' && selectedCategory === 'ALL' && designItemCount === 0;
