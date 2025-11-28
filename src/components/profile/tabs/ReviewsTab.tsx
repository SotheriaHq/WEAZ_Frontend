import React, { useState } from 'react';
import { ThumbsUp, CheckCircle2 } from 'lucide-react';
import Card from '../../ui/Card';
import Avatar from '../../ui/Avatar';

interface Review {
  id: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  date: string;
  comment: string;
  helpful: number;
  verifiedPurchase: boolean;
}

const dummyReviews: Review[] = [
  {
    id: '1',
    userName: 'Sarah Johnson',
    userAvatar: undefined,
    rating: 5,
    date: '2025-01-10',
    comment: "Absolutely love the quality and attention to detail! The fabric feels premium and the fit is perfect. This brand has become my go-to for special occasions. Can't wait to order more pieces!",
    helpful: 24,
    verifiedPurchase: true,
  },
  {
    id: '2',
    userName: 'Michael Chen',
    userAvatar: undefined,
    rating: 4,
    date: '2025-01-08',
    comment: 'Great customer service and unique designs. The delivery was faster than expected. Only minor issue was sizing ran a bit small, but overall very satisfied with my purchase.',
    helpful: 18,
    verifiedPurchase: true,
  },
  {
    id: '3',
    userName: 'Aisha Bakare',
    userAvatar: undefined,
    rating: 5,
    date: '2025-01-05',
    comment: 'Finally found a brand that celebrates African heritage with modern style! The craftsmanship is exceptional and I always get compliments when wearing their pieces. Highly recommend!',
    helpful: 31,
    verifiedPurchase: true,
  },
  {
    id: '4',
    userName: 'David Williams',
    userAvatar: undefined,
    rating: 4,
    date: '2025-01-02',
    comment: 'Beautiful designs and sustainable practices. The packaging was eco-friendly which I really appreciated. Prices are reasonable for the quality you get.',
    helpful: 12,
    verifiedPurchase: false,
  },
  {
    id: '5',
    userName: 'Fatima Okafor',
    userAvatar: undefined,
    rating: 5,
    date: '2024-12-28',
    comment: 'This brand understands fashion! Every piece tells a story and the attention to cultural details is remarkable. I own 5 pieces now and planning to buy more.',
    helpful: 29,
    verifiedPurchase: true,
  },
  {
    id: '6',
    userName: 'James Rodriguez',
    userAvatar: undefined,
    rating: 3,
    date: '2024-12-20',
    comment: 'Good quality overall but had some issues with color matching online photos. Customer service was helpful in resolving it. Would order again but check in-store first.',
    helpful: 8,
    verifiedPurchase: true,
  },
  {
    id: '7',
    userName: 'Chioma Nwosu',
    userAvatar: undefined,
    rating: 5,
    date: '2024-12-15',
    comment: 'Exceptional quality and beautiful designs! The fabrics are authentic and the modern cuts make them perfect for any occasion. This brand represents Nigerian fashion at its finest.',
    helpful: 41,
    verifiedPurchase: true,
  },
  {
    id: '8',
    userName: 'Emily Thompson',
    userAvatar: undefined,
    rating: 4,
    date: '2024-12-10',
    comment: 'Love supporting brands with such rich cultural heritage. The pieces are conversation starters and the quality justifies the price. Shipping took a bit long but worth the wait.',
    helpful: 15,
    verifiedPurchase: false,
  },
];

interface RatingStarsProps {
  rating: number;
  size?: 'sm' | 'md' | 'lg';
}

const RatingStars: React.FC<RatingStarsProps> = ({ rating, size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`${sizeClasses[size]} ${
            star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 dark:text-gray-600'
          }`}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

type SortOption = 'recent' | 'highest';

const ReviewsTab: React.FC = () => {
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [helpfulClicks, setHelpfulClicks] = useState<Record<string, number>>({});

  const sortedReviews = [...dummyReviews].sort((a, b) => {
    if (sortBy === 'recent') {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    } else {
      // Sort by rating, then by helpful count
      if (b.rating !== a.rating) {
        return b.rating - a.rating;
      }
      return b.helpful - a.helpful;
    }
  });

  const handleHelpfulClick = (reviewId: string) => {
    setHelpfulClicks(prev => ({
      ...prev,
      [reviewId]: (prev[reviewId] || 0) + 1,
    }));
  };

  const averageRating = (
    dummyReviews.reduce((sum, review) => sum + review.rating, 0) / dummyReviews.length
  ).toFixed(1);

  const ratingDistribution = [5, 4, 3, 2, 1].map(rating => ({
    stars: rating,
    count: dummyReviews.filter(r => r.rating === rating).length,
    percentage: (dummyReviews.filter(r => r.rating === rating).length / dummyReviews.length) * 100,
  }));

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Reviews Summary */}
      <section className="bg-gradient-to-r from-purple-50 via-pink-50 to-indigo-50 dark:from-purple-900/20 dark:via-pink-900/20 dark:to-indigo-900/20 rounded-2xl p-8 border border-purple-100 dark:border-purple-800/30">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Average Rating */}
          <div className="text-center md:text-left">
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div>
                <div className="text-6xl font-bold text-gray-900 dark:text-white">
                  {averageRating}
                </div>
                <RatingStars rating={Math.round(parseFloat(averageRating))} size="lg" />
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  Based on {dummyReviews.length} reviews
                </p>
              </div>
            </div>
          </div>

          {/* Rating Distribution */}
          <div className="space-y-2">
            {ratingDistribution.map(({ stars, count, percentage }) => (
              <div key={stars} className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-12">
                  {stars} star
                </span>
                <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400 w-8 text-right">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sort Options */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Customer Reviews
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setSortBy('recent')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              sortBy === 'recent'
                ? 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            Most Recent
          </button>
          <button
            onClick={() => setSortBy('highest')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              sortBy === 'highest'
                ? 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            Highest Rated
          </button>
        </div>
      </div>

      {/* Reviews Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {sortedReviews.map((review) => (
          <Card key={review.id} variant="bordered" padding="lg" className="hover:shadow-lg transition-shadow">
            <div className="space-y-4">
              {/* Reviewer Info */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar
                    src={review.userAvatar}
                    alt={review.userName}
                    size="md"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {review.userName}
                      </h4>
                      {review.verifiedPurchase && (
                        <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="text-xs font-medium">Verified</span>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(review.date)}
                    </p>
                  </div>
                </div>
                <RatingStars rating={review.rating} size="sm" />
              </div>

              {/* Review Comment */}
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                {review.comment}
              </p>

              {/* Helpful Button */}
              <div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => handleHelpfulClick(review.id)}
                  className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                >
                  <ThumbsUp className="w-4 h-4" />
                  <span>Helpful ({review.helpful + (helpfulClicks[review.id] || 0)})</span>
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ReviewsTab;
