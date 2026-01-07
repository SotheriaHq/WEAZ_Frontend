import React from 'react';

interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  rating?: number;
  reviewCount?: number;
  sizes?: string[];
  isNew?: boolean;
  isSale?: boolean;
}

interface StoreProductGridProps {
  products: Product[];
  storeName: string;
  isOwner?: boolean;
  onAddToCart?: (productId: string) => void;
  onQuickView?: (productId: string) => void;
  onWishlist?: (productId: string) => void;
}

/**
 * Store Product Grid Component
 * Displays products in a responsive grid with hover effects
 */
const StoreProductGrid: React.FC<StoreProductGridProps> = ({
  products,
  storeName,
  isOwner = false,
  onAddToCart,
  onQuickView,
  onWishlist,
}) => {
  if (products.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {products.map((product) => (
        <div
          key={product.id}
          className="bg-white dark:bg-[#1a1a1a] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 group hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
        >
          {/* Image */}
          <div className="relative h-72 overflow-hidden bg-gray-100 dark:bg-gray-900">
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />

            {/* Badges */}
            <div className="absolute top-3 left-3 flex flex-col gap-2">
              {product.isNew && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500 text-white">
                  ✨ New
                </span>
              )}
              {product.isSale && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-500 text-white">
                  🏷️ Sale
                </span>
              )}
            </div>

            {/* Wishlist Button */}
            {onWishlist && !isOwner && (
              <button
                onClick={() => onWishlist(product.id)}
                className="absolute top-3 right-3 h-10 w-10 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
              >
                ❤️
              </button>
            )}

            {/* Quick View Overlay */}
            {onQuickView && (
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onQuickView(product.id)}
                  className="w-full py-2 rounded-full text-sm font-medium bg-white/95 hover:bg-white text-gray-900 transition-colors"
                >
                  👁️ Quick View
                </button>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{storeName}</p>
            <h4 className="text-base font-medium text-gray-900 dark:text-white mb-2 line-clamp-2">
              {product.name}
            </h4>

            {/* Rating */}
            {product.rating && (
              <div className="flex items-center mb-2">
                <span className="text-xs text-yellow-500 mr-1">⭐</span>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {product.rating.toFixed(1)}
                </span>
                {product.reviewCount && (
                  <span className="text-xs text-gray-400 ml-1">
                    ({product.reviewCount})
                  </span>
                )}
              </div>
            )}

            {/* Price & Add to Cart */}
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <p className={`text-lg font-semibold ${product.isSale ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                    ${product.price.toFixed(2)}
                  </p>
                  {product.originalPrice && (
                    <p className="text-sm text-gray-400 line-through">
                      ${product.originalPrice.toFixed(2)}
                    </p>
                  )}
                </div>
                {product.sizes && product.sizes.length > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {product.sizes.join(', ')} available
                  </p>
                )}
              </div>

              {onAddToCart && !isOwner && (
                <button
                  onClick={() => onAddToCart(product.id)}
                  className="h-10 w-10 bg-purple-600 hover:bg-purple-700 text-white rounded-full flex items-center justify-center transition-colors shadow-md"
                >
                  ➕
                </button>
              )}

              {isOwner && (
                <a
                  href={`/studio/products/${product.id}/edit`}
                  className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
                >
                  Edit
                </a>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StoreProductGrid;
