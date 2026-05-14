import React from 'react';
import StoreProductCard from '@/components/designs/StoreProductCard';

export type ProductCardProps = React.ComponentProps<typeof StoreProductCard>;

const ProductCard: React.FC<ProductCardProps> = ({ product, ...props }) => (
  <StoreProductCard {...props} product={{ ...product, entityType: 'PRODUCT' }} />
);

export default React.memo(ProductCard);
