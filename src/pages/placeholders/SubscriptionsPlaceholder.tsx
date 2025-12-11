import React from 'react';
import ComingSoon from './ComingSoon';

/**
 * SubscriptionsPlaceholder - Coming soon page for Subscriptions
 */
const SubscriptionsPlaceholder: React.FC = () => (
  <ComingSoon
    title="Subscriptions"
    description="Follow your favorite brands and creators to get exclusive content, early access to drops, and special member perks."
    emoji="📺"
    variant="social"
    eta="Q1 2025"
    features={[
      'Exclusive Content',
      'Early Drop Access',
      'Member Discounts',
      'Behind The Scenes',
    ]}
  />
);

export default SubscriptionsPlaceholder;
