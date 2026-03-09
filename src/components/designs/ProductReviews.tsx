import React, { useState } from 'react';
import { Star, ThumbsUp, ChevronDown, Filter, Image as ImageIcon, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MediaRenderer from '@/components/media/MediaRenderer';

// Types
export interface ReviewUser {
  id: string;
  username: string;
  avatar?: string;
  isVerifiedBuyer?: boolean;
}

export interface ProductReview {
  id: string;
  user: ReviewUser;
  rating: number;
  title?: string;
  comment: string;
  images?: string[];
  helpfulCount: number;
  isHelpful?: boolean;
  createdAt: string;
  variant?: string; // e.g., "Size: M, Color: Black"
}

export interface ReviewsSummary {
  averageRating: number;
  totalReviews: number;
  distribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

interface ProductReviewsProps {
  summary: ReviewsSummary;
  reviews: ProductReview[];
  isLoading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  onMarkHelpful?: (reviewId: string) => void;
}

type SortOption = 'most-recent' | 'highest-rating' | 'lowest-rating' | 'most-helpful';
type FilterOption = 'all' | '5' | '4' | '3' | '2' | '1' | 'with-images';

/**
 * ProductReviews Component
 * 
 * Displays product reviews with:
 * - Rating distribution breakdown
 * - Average rating display
 * - Sortable & filterable review list
 * - Image gallery in reviews
 * - Helpful vote system
 * - Load more pagination
 * 
 * Design: Modern glass morphism with dark theme support
 */
const ProductReviews: React.FC<ProductReviewsProps> = ({
  summary,
  reviews,
  isLoading = false,
  onLoadMore,
  hasMore = false,
  onMarkHelpful,
}) => {
  const [sortBy, setSortBy] = useState<SortOption>('most-recent');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const sortLabels: Record<SortOption, string> = {
    'most-recent': 'Most Recent',
    'highest-rating': 'Highest Rating',
    'lowest-rating': 'Lowest Rating',
    'most-helpful': 'Most Helpful',
  };

  const filterLabels: Record<FilterOption, string> = {
    'all': 'All Reviews',
    '5': '5 Stars',
    '4': '4 Stars',
    '3': '3 Stars',
    '2': '2 Stars',
    '1': '1 Star',
    'with-images': 'With Images',
  };

  // Filter and sort reviews
  const filteredReviews = reviews.filter(review => {
    if (filterBy === 'all') return true;
    if (filterBy === 'with-images') return review.images && review.images.length > 0;
    return review.rating === parseInt(filterBy);
  });

  const sortedReviews = [...filteredReviews].sort((a, b) => {
    switch (sortBy) {
      case 'highest-rating':
        return b.rating - a.rating;
      case 'lowest-rating':
        return a.rating - b.rating;
      case 'most-helpful':
        return b.helpfulCount - a.helpfulCount;
      case 'most-recent':
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getInitials = (username: string) => {
    return username.slice(0, 2).toUpperCase();
  };

  // Calculate percentage for distribution bars
  const getDistributionPercent = (count: number) => {
    if (summary.totalReviews === 0) return 0;
    return (count / summary.totalReviews) * 100;
  };

  return (
    <div className="w-full">
      {/* Header with Summary */}
      <div className="flex flex-col lg:flex-row gap-8 pb-8 border-b border-gray-200 dark:border-gray-800">
        {/* Left - Average Rating */}
        <div className="flex-shrink-0 text-center lg:text-left">
          <div className="text-6xl font-bold text-gray-900 dark:text-white mb-2">
            {summary.averageRating.toFixed(1)}
          </div>
          <div className="flex items-center justify-center lg:justify-start gap-1 mb-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={20}
                fill={i < Math.floor(summary.averageRating) ? '#FBBF24' : 'none'}
                className={i < Math.floor(summary.averageRating) ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'}
              />
            ))}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Based on {summary.totalReviews} reviews
          </p>
        </div>

        {/* Right - Distribution Bars */}
        <div className="flex-1 space-y-2">
          {([5, 4, 3, 2, 1] as const).map((star) => (
            <button
              key={star}
              onClick={() => setFilterBy(filterBy === star.toString() ? 'all' : star.toString() as FilterOption)}
              className={`w-full flex items-center gap-3 group p-1 rounded-lg transition-colors ${
                filterBy === star.toString() ? 'bg-purple-50 dark:bg-purple-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-900/50'
              }`}
            >
              <div className="flex items-center gap-1 w-16 flex-shrink-0">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{star}</span>
                <Star size={14} className="text-amber-400" fill="#FBBF24" />
              </div>
              
              <div className="flex-1 h-3 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${getDistributionPercent(summary.distribution[star])}%` }}
                  transition={{ duration: 0.5, delay: (5 - star) * 0.1 }}
                  className={`h-full rounded-full ${
                    star >= 4 ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
                    star === 3 ? 'bg-gradient-to-r from-amber-400 to-yellow-500' :
                    'bg-gradient-to-r from-red-400 to-rose-500'
                  }`}
                />
              </div>
              
              <span className="w-12 text-right text-sm text-gray-500 dark:text-gray-400">
                {summary.distribution[star]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Filters & Sort */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-6">
        {/* Filter pills */}
        <div className="flex flex-wrap gap-2">
          {(['all', 'with-images', '5', '4', '3', '2', '1'] as FilterOption[]).map((option) => (
            <button
              key={option}
              onClick={() => setFilterBy(option)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                filterBy === option
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {option === 'with-images' && <ImageIcon size={14} className="inline mr-1.5" />}
              {filterLabels[option]}
            </button>
          ))}
        </div>

        {/* Sort dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowSortDropdown(!showSortDropdown)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <Filter size={14} />
            {sortLabels[sortBy]}
            <ChevronDown size={14} className={`transition-transform ${showSortDropdown ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {showSortDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowSortDropdown(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 mt-2 w-48 py-2 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-20"
                >
                  {(Object.keys(sortLabels) as SortOption[]).map((option) => (
                    <button
                      key={option}
                      onClick={() => {
                        setSortBy(option);
                        setShowSortDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        sortBy === option
                          ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 font-medium'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      {sortLabels[option]}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-6">
        {sortedReviews.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
              <Star size={28} className="text-gray-400" />
            </div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No reviews yet
            </h4>
            <p className="text-gray-500 dark:text-gray-400">
              Be the first to review this product
            </p>
          </div>
        )}

        {sortedReviews.map((review, index) => (
          <motion.div
            key={review.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="p-6 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800"
          >
            {/* Review Header */}
            <div className="flex items-start gap-4 mb-4">
              {/* Avatar */}
              <div className="flex-shrink-0">
                {review.user.avatar ? (
                  <div className="max-h-12 max-w-12 overflow-hidden rounded-full ring-2 ring-white dark:ring-gray-800">
                    <MediaRenderer
                      kind="image"
                      src={review.user.avatar}
                      alt={review.user.username}
                      maxHeightClassName="max-h-12"
                      maxWidthClassName="max-w-12"
                      className="rounded-full"
                      mediaClassName="rounded-full"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                    {getInitials(review.user.username)}
                  </div>
                )}
              </div>

              {/* User info & rating */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {review.user.username}
                  </span>
                  {review.user.isVerifiedBuyer && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium">
                      <Check size={10} />
                      Verified Buyer
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={14}
                        fill={i < review.rating ? '#FBBF24' : 'none'}
                        className={i < review.rating ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(review.createdAt)}
                  </span>
                </div>

                {review.variant && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 block">
                    Purchased: {review.variant}
                  </span>
                )}
              </div>
            </div>

            {/* Review Content */}
            {review.title && (
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                {review.title}
              </h4>
            )}
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              {review.comment}
            </p>

            {/* Review Images */}
            {review.images && review.images.length > 0 && (
              <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                {review.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setExpandedImage(img);
                    }}
                    className="flex-shrink-0 rounded-lg overflow-hidden ring-2 ring-transparent hover:ring-purple-500 transition-all"
                  >
                    <MediaRenderer
                      kind="image"
                      src={img}
                      alt=""
                      maxHeightClassName="max-h-20"
                      maxWidthClassName="max-w-20"
                      className="rounded-lg"
                      mediaClassName="rounded-lg"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Helpful button */}
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => onMarkHelpful?.(review.id)}
                className={`flex items-center gap-2 text-sm transition-colors ${
                  review.isHelpful
                    ? 'text-purple-600 dark:text-purple-400 font-medium'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <ThumbsUp size={14} fill={review.isHelpful ? 'currentColor' : 'none'} />
                Helpful ({review.helpfulCount})
              </button>
            </div>
          </motion.div>
        ))}

        {/* Load More */}
        {hasMore && !isLoading && (
          <div className="text-center pt-4">
            <button
              onClick={onLoadMore}
              className="px-6 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Load More Reviews
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-6 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 animate-pulse">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700" />
                  <div className="flex-1">
                    <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                    <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                </div>
                <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Image Lightbox */}
      <AnimatePresence>
        {expandedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-layer-modal flex items-center justify-center p-4"
            onClick={() => {
              setExpandedImage(null);
            }}
          >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.img
              src={expandedImage}
              alt="Review image"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-full max-h-[90vh] rounded-2xl shadow-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProductReviews;
