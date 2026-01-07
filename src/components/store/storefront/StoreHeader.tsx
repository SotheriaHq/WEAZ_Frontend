import React from 'react';

interface StoreHeaderProps {
  storeName: string;
  tagline?: string;
  logoUrl?: string;
  isVerified?: boolean;
  followerCount?: number;
  reviewCount?: number;
  productCount?: number;
  rating?: number;
  categories?: string[];
  instagram?: string;
  twitter?: string;
  website?: string;
  isOwner?: boolean;
  onFollow?: () => void;
  onMessage?: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  streetwear: 'Streetwear',
  casual: 'Casual Wear',
  formal: 'Formal',
  athletic: 'Athletic',
  vintage: 'Vintage',
  luxury: 'Luxury',
  sustainable: 'Sustainable',
  accessories: 'Accessories',
  'african-fashion': 'African Fashion',
  'western-fashion': 'Western Fashion',
};

/**
 * Store Header Component
 * Displays store name, logo, verified badge, stats, and action buttons
 */
const StoreHeader: React.FC<StoreHeaderProps> = ({
  storeName,
  tagline,
  logoUrl,
  isVerified = false,
  followerCount = 0,
  reviewCount = 0,
  productCount = 0,
  rating = 0,
  categories = [],
  instagram,
  twitter,
  website,
  isOwner = false,
  onFollow,
  onMessage,
}) => {
  return (
    <div className="bg-white dark:bg-[#1a1a1a] border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          {/* Store Info */}
          <div className="flex items-center space-x-6">
            {/* Logo */}
            <div className="h-20 w-20 rounded-full flex items-center justify-center text-3xl font-serif shadow-lg overflow-hidden flex-shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt={storeName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white">
                  {storeName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div>
              {/* Name + Verified Badge */}
              <div className="flex items-center space-x-2 mb-1">
                <h1 className="text-2xl md:text-3xl font-serif font-semibold text-gray-900 dark:text-white">
                  {storeName}
                </h1>
                {isVerified && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300">
                    ✓ Verified
                  </span>
                )}
              </div>

              {/* Tagline */}
              {tagline && (
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">{tagline}</p>
              )}

              {/* Stats */}
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                {rating > 0 && (
                  <span className="flex items-center">
                    ⭐ {rating.toFixed(1)} ({reviewCount.toLocaleString()} reviews)
                  </span>
                )}
                {rating > 0 && <span className="hidden sm:inline">•</span>}
                <span>{followerCount.toLocaleString()} followers</span>
                <span>•</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {productCount} products
                </span>
              </div>

              {/* Categories */}
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {categories.map((cat) => (
                    <span
                      key={cat}
                      className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-xs text-purple-600 dark:text-purple-300"
                    >
                      {CATEGORY_LABELS[cat] || cat}
                    </span>
                  ))}
                </div>
              )}

              {/* Social Links */}
              {(instagram || twitter || website) && (
                <div className="flex items-center gap-3 mt-3">
                  {instagram && (
                    <a
                      href={`https://instagram.com/${instagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-500 hover:text-pink-500 transition-colors text-lg"
                      title="Instagram"
                    >
                      📸
                    </a>
                  )}
                  {twitter && (
                    <a
                      href={`https://twitter.com/${twitter}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-500 hover:text-blue-500 transition-colors text-lg"
                      title="Twitter"
                    >
                      🐦
                    </a>
                  )}
                  {website && (
                    <a
                      href={website.startsWith('http') ? website : `https://${website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-500 hover:text-green-500 transition-colors text-lg"
                      title="Website"
                    >
                      🌐
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          {!isOwner && (
            <div className="flex items-center space-x-3">
              {onMessage && (
                <button
                  onClick={onMessage}
                  className="px-6 py-2.5 rounded-full text-sm font-medium border border-gray-300 dark:border-gray-600 bg-white dark:bg-white/5 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-white/10 transition-colors flex items-center gap-2"
                >
                  💬 Message
                </button>
              )}
              {onFollow && (
                <button
                  onClick={onFollow}
                  className="px-6 py-2.5 rounded-full text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors flex items-center gap-2"
                >
                  ➕ Follow Store
                </button>
              )}
            </div>
          )}

          {/* Owner Actions */}
          {isOwner && (
            <div className="flex items-center space-x-3">
              <a
                href="/settings/store"
                className="px-6 py-2.5 rounded-full text-sm font-medium border border-gray-300 dark:border-gray-600 bg-white dark:bg-white/5 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-white/10 transition-colors flex items-center gap-2"
              >
                ⚙️ Store Settings
              </a>
              <a
                href="/studio/products/new"
                className="px-6 py-2.5 rounded-full text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors flex items-center gap-2"
              >
                ➕ Add Product
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StoreHeader;
