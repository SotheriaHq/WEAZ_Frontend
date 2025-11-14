import React from 'react';
import UnifiedCollectionComments from '@/components/collections/UnifiedCollectionComments';
import { MessageCircle } from 'lucide-react';

interface Props {
  collectionId: string;
  activeMediaId?: string | null;
  className?: string;
}

export const CompactCommentsSection: React.FC<Props> = ({ collectionId, className = '' }) => {

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-gray-200 dark:border-gray-700">
        <MessageCircle className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Comments</h3>
      </div>

      {/* All Comments - Scrollable with hidden scrollbar */}
      <div className="flex-1 overflow-y-auto pt-3 space-y-6" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <style>{`
          .compact-comments-scroll::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        <div className="compact-comments-scroll">
          <UnifiedCollectionComments collectionId={collectionId} />
        </div>
      </div>
    </div>
  );
};

export default CompactCommentsSection;
