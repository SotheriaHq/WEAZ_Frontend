import React from 'react';
import ComingSoon from './ComingSoon';

/**
 * WatchLaterPlaceholder - Coming soon page for saved items
 */
const WatchLaterPlaceholder: React.FC = () => (
  <ComingSoon
    title="Watch Later"
    description="Save collections and designs to check out later. Build your personal queue of fashion inspiration."
    emoji="⏰"
    variant="default"
    eta="Q1 2025"
    features={[
      'Save for Later',
      'Organize Queues',
      'Reminder Notifications',
      'Cross-Device Sync',
    ]}
  />
);

export default WatchLaterPlaceholder;
