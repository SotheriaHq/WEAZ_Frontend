import React, { useState } from 'react';
import CommentThread from '@/components/comments/CommentThread';
import { MessageCircle } from 'lucide-react';

interface Props {
  collectionId: string;
  activeMediaId?: string | null;
  className?: string;
}

export const CompactCommentsSection: React.FC<Props> = ({ collectionId, activeMediaId, className = '' }) => {
  const [mode, setMode] = useState<'collection' | 'item'>('collection');
  const showItem = Boolean(activeMediaId);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header with Tab Toggle */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 text-gray-900 dark:text-white">
          <MessageCircle className="w-4 h-4" />
          <h3 className="text-sm font-semibold">Comments</h3>
        </div>
        {showItem && (
          <div className="flex rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5 text-[11px]">
            <button
              onClick={() => setMode('collection')}
              className={`px-2.5 py-1 rounded-md transition ${
                mode === 'collection'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Collection
            </button>
            <button
              onClick={() => setMode('item')}
              className={`px-2.5 py-1 rounded-md transition ${
                mode === 'item'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Current Item
            </button>
          </div>
        )}
      </div>

      {/* Comments Thread - Scrollable */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent pt-3">
        {mode === 'collection' && <CommentThread targetType="COLLECTION" targetId={collectionId} />}
        {mode === 'item' && showItem && <CommentThread targetType="COLLECTION_MEDIA" targetId={activeMediaId!} />}
      </div>
    </div>
  );
};

export default CompactCommentsSection;
