import React from 'react';
import ComingSoon from './ComingSoon';

/**
 * TrendingPlaceholder - Coming soon page for trending content
 */
const TrendingPlaceholder: React.FC = () => (
  <ComingSoon
    title="Trending Now"
    description="Discover what's hot in fashion right now. Explore trending collections, viral designs, and rising creators."
    emoji="📈"
    variant="social"
    eta="Q1 2025"
    features={[
      'Real-time Trends',
      'Viral Collections',
      'Rising Creators',
      'Trend Analytics',
    ]}
  />
);

export default TrendingPlaceholder;
