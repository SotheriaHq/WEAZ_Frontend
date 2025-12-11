import React from 'react';
import ComingSoon from './ComingSoon';

/**
 * MarketplacePlaceholder - Coming soon page for the Marketplace
 */
const MarketplacePlaceholder: React.FC = () => (
  <ComingSoon
    title="Marketplace"
    description="A revolutionary shopping experience is coming! Browse and purchase exclusive fashion pieces from top designers and brands worldwide."
    emoji="🛍️"
    variant="marketplace"
    eta="Q1 2025"
    features={[
      'Shop Exclusive Drops',
      'Secure Checkout',
      'Global Shipping',
      'Buyer Protection',
    ]}
  />
);

export default MarketplacePlaceholder;
