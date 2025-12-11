import React from 'react';
import ComingSoon from './ComingSoon';

/**
 * HistoryPlaceholder - Coming soon page for browsing history
 */
const HistoryPlaceholder: React.FC = () => (
  <ComingSoon
    title="Your History"
    description="Keep track of everything you've viewed. Easily revisit collections, designs, and brand pages you've explored."
    emoji="🕒"
    variant="default"
    eta="Q1 2025"
    features={[
      'View History Timeline',
      'Quick Re-discovery',
      'Privacy Controls',
      'Clear History',
    ]}
  />
);

export default HistoryPlaceholder;
