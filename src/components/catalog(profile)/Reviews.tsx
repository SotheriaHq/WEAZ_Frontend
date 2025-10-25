import React, { useState } from 'react';
import { Star, MessageCircle, Heart, CheckCircle } from 'lucide-react';
import type { ReviewDto, ReviewsResponse } from '../../types/profile'; // Import the specific DTO type

// We will use the ReviewsResponse structure for the props
interface ReviewsProps {
  reviewsData: ReviewsResponse;
}

// Mock data (using the ReviewDto structure)
const mockReviews: ReviewDto[] = [
  {
    id: '1',
    userId: 'u1',
    userName: 'Aisha Mohammed',
    userImage: 'https://ui-avatars.com/api/?name=Aisha+Mohammed&background=9333EA&color=fff',
    brandId: 'b1',
    rating: 5,
    comment: 'Absolutely stunning pieces! The quality exceeded my expectations. The Ankara fabric is authentic and the stitching is impeccable.',
    helpful: 24,
    verified: true,
    images: ['https://images.unsplash.com/photo-1577909386407-35338014524c?w=400&h=300&fit=crop'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // NOTE: The 'purchasedItem' field is not in ReviewDto, so I removed it to be type-safe.
  },
  {
    id: '2',
    userId: 'u2',
    userName: 'Chidinma Okafor',
    userImage: 'https://ui-avatars.com/api/?name=Chidinma+Okafor&background=EC4899&color=fff',
    brandId: 'b1',
    rating: 5,
    comment: 'Best fashion brand in Nigeria! Every piece tells a story. Love how they blend traditional and contemporary styles. The fit is perfect.',
    helpful: 18,
    verified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  // Add more mock data to ensure scrolling functionality is testable
  {
    id: '3',
    userId: 'u3',
    userName: 'Tunde Bakare',
    userImage: 'https://ui-avatars.com/api/?name=Tunde+Bakare&background=3B82F6&color=fff',
    brandId: 'b1',
    rating: 4,
    comment: 'Great designs and fast delivery. Only minor issue was sizing ran a bit small, but customer service was very helpful.',
    helpful: 12,
    verified: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '4',
    userId: 'u4',
    userName: 'Ngozi E.',
    brandId: 'b1',
    rating: 5,
    comment: 'The material quality is amazing! I receive compliments everywhere I go.',
    helpful: 30,
    verified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '5',
    userId: 'u5',
    userName: 'Bisi A.',
    brandId: 'b1',
    rating: 3,
    comment: 'It was okay, but the color was slightly different from the image.',
    helpful: 5,
    verified: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockReviewsData: ReviewsResponse = {
  reviews: mockReviews,
  averageRating: 4.8,
  totalReviews: 156,
  ratingDistribution: [
    { stars: 5, count: 120, percentage: 77 },
    { stars: 4, count: 25, percentage: 16 },
    { stars: 3, count: 8, percentage: 5 },
    { stars: 2, count: 2, percentage: 1 },
    { stars: 1, count: 1, percentage: 1 }
  ],
};

const Reviews: React.FC<ReviewsProps> = ({
  reviewsData = mockReviewsData, // Use the BrandProfileDto structure
}) => {
  const { reviews, averageRating, totalReviews, ratingDistribution } = reviewsData;
  const [filter, setFilter] = useState<'all' | 5 | 4 | 3 | 2 | 1>('all');

  const filteredReviews = filter === 'all'
    ? reviews
    : reviews.filter((r: ReviewDto) => r.rating === filter);

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star: number) => (
          <Star
            key={star}
            className={`w-4 h-4 transition-colors ${
              star <= rating
                ? 'fill-yellow-500 text-yellow-500'
                : 'fill-gray-300 text-gray-300 dark:fill-gray-700 dark:text-gray-700'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      
      {/* 1. Editorial Rating Header (Stable and Typed) */}
      <div className="bg-white dark:bg-gray-900 shadow-xl rounded-2xl p-6 md:p-10 border border-gray-100 dark:border-gray-800">
        <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-6">
          Customer Impressions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          
          {/* Overall Rating Block */}
          <div className="text-center md:border-r md:border-gray-200 dark:md:border-gray-700 pr-0 md:pr-8">
            <p className="text-sm font-semibold uppercase text-purple-600 dark:text-purple-400">Average Rating</p>
            <div className="text-7xl font-bold text-gray-900 dark:text-white my-2">{averageRating.toFixed(1)}</div>
            <div className="flex justify-center mb-2">{renderStars(Math.round(averageRating))}</div>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
              ({totalReviews} total reviews)
            </p>
          </div>

          {/* Rating Distribution Bars */}
          <div className="md:col-span-2 space-y-2">
            {ratingDistribution.map((item) => (
              <button
                key={item.stars}
                onClick={() => setFilter(item.stars as 5 | 4 | 3 | 2 | 1)}
                className="w-full flex items-center gap-3 p-2 rounded-lg transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 group"
              >
                <span className="text-gray-700 dark:text-gray-300 font-semibold text-sm w-12 text-left">{item.stars} Stars</span>
                <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all duration-500"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
                <span className="text-gray-500 dark:text-gray-400 text-xs font-medium w-10 text-right">
                  {item.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      ---

      {/* 2. Review Filter Tabs (Pill-shaped) */}
      <div className="flex gap-3 overflow-x-auto pb-2 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-full font-medium text-sm whitespace-nowrap transition-colors ${
            filter === 'all'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          All Reviews ({reviews.length})
        </button>
        {[5, 4, 3, 2, 1].map((stars: number) => (
          <button
            key={stars}
            onClick={() => setFilter(stars as 5 | 4 | 3 | 2 | 1)}
            className={`px-4 py-2 rounded-full font-medium text-sm whitespace-nowrap transition-colors ${
              filter === stars
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {stars} Stars
          </button>
        ))}
      </div>

      ---

      {/* 3. Reviews List - The core feed */}
      <div className="space-y-6">
        {filteredReviews.map((review: ReviewDto) => (
          <div
            key={review.id}
            className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                {/* Larger User Avatar */}
                {review.userImage && (
                  <img
                    src={review.userImage}
                    alt={review.userName}
                    className="w-14 h-14 rounded-full object-cover border-4 border-purple-500/20"
                  />
                )}
                <div>
                  <h4 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                    {review.userName}
                    {review.verified && (
                    
                      <CheckCircle className="w-4 h-4 text-green-500" aria-label="Verified Buyer" />
                    )}
                  </h4>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Reviewed on {new Date(review.createdAt).toLocaleDateString('en-US', {
                      month: 'long', day: 'numeric', year: 'numeric'
                    })}
                  </span>
                </div>
              </div>
              {renderStars(review.rating)}
            </div>

            {/* Review Text - Emphasized Quote */}
            <p className="text-gray-800 dark:text-gray-200 leading-relaxed italic border-l-4 border-purple-500 pl-4 py-2 mt-4 mb-4">
              "{review.comment}"
            </p>

            {/* Review Images - Now typed and fixed */}
            {review.images && review.images.length > 0 && (
              <div className="flex gap-4 mb-4">
                {review.images.map((img: string, idx: number) => (
                  <img
                    key={idx}
                    src={img}
                    alt={`Review image ${idx + 1}`}
                    className="w-28 h-28 object-cover rounded-xl shadow-lg border-2 border-gray-100 dark:border-gray-700 hover:scale-[1.02] transition-transform duration-300 cursor-pointer"
                  />
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-6 pt-4 border-t border-gray-100 dark:border-gray-800">
              <button className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-red-500 transition-colors">
                <Heart className="w-4 h-4 fill-current" aria-label="Favorite this review" />
                <span className="text-sm font-medium">Favorite ({review.helpful})</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredReviews.length === 0 && (
        <div className="text-center py-16 bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
          <MessageCircle className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No reviews match this filter
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Try selecting "All Reviews" to see everything.
          </p>
        </div>
      )}
    </div>
  );
};

export default Reviews;
