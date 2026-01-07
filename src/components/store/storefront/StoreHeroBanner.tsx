import React from 'react';

interface StoreHeroBannerProps {
  bannerUrl?: string;
  title?: string;
  subtitle?: string;
  badge?: string;
  ctaText?: string;
  ctaHref?: string;
  isOwner?: boolean;
  onEditBanner?: () => void;
}

/**
 * Store Hero Banner Component
 * Full-width hero section with parallax background, title, and CTA
 */
const StoreHeroBanner: React.FC<StoreHeroBannerProps> = ({
  bannerUrl,
  title = 'Welcome to Our Store',
  subtitle,
  badge,
  ctaText,
  ctaHref,
  isOwner = false,
  onEditBanner,
}) => {
  return (
    <div className="relative h-64 md:h-96 overflow-hidden bg-gray-900">
      {/* Background Image or Gradient */}
      {bannerUrl ? (
        <img
          src={bannerUrl}
          alt="Store Banner"
          className="w-full h-full object-cover opacity-80"
          style={{ backgroundAttachment: 'fixed' }}
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-purple-600/40 via-pink-500/40 to-orange-500/40" />
      )}

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

      {/* Content */}
      <div className="absolute inset-0 flex items-center justify-center text-center px-4">
        <div>
          {badge && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-500/90 text-white mb-4">
              ✨ {badge}
            </span>
          )}
          <h2 className="text-3xl md:text-5xl font-serif text-white mb-3 drop-shadow-lg">
            {title}
          </h2>
          {subtitle && (
            <p className="text-white/90 text-base md:text-lg mb-6 max-w-2xl mx-auto">
              {subtitle}
            </p>
          )}
          {ctaText && ctaHref && (
            <a
              href={ctaHref}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-full text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors shadow-lg"
            >
              {ctaText}
            </a>
          )}
        </div>
      </div>

      {/* Owner Edit Button */}
      {isOwner && onEditBanner && (
        <button
          onClick={onEditBanner}
          className="absolute top-4 right-4 px-4 py-2 rounded-full text-sm font-medium bg-white/90 hover:bg-white text-gray-900 transition-colors shadow-lg flex items-center gap-2"
        >
          ✏️ Edit Banner
        </button>
      )}
    </div>
  );
};

export default StoreHeroBanner;
