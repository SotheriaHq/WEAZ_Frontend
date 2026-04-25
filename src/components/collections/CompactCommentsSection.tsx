import React from 'react';
import UnifiedCollectionComments from '@/components/collections/UnifiedCollectionComments';
import { MessageCircle } from 'lucide-react';

interface Props {
  collectionId: string;
  activeMediaId?: string | null;
  className?: string;
  onCommentAdded?: () => void;
}

export const CompactCommentsSection: React.FC<Props> = ({ collectionId, className = '', onCommentAdded }) => {
  return (
    <div className={`flex flex-col h-full min-h-0 ${className}`}>
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-2 pb-3 border-b border-gray-200 dark:border-gray-700">
        <MessageCircle className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Comments</h3>
      </div>

      {/* Comments container - MUST constrain height */}
      <div 
        className="flex-1 overflow-hidden min-h-0 pt-2"
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        <div className="flex-1 min-h-0">
          <UnifiedCollectionComments collectionId={collectionId} onCommentAdded={onCommentAdded} />
        </div>
      </div>
    </div>
  );
};

export default CompactCommentsSection;
