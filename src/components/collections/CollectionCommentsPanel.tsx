import React, { useState } from 'react';
import CommentThread from '@/components/comments/CommentThread';
import Tabs from '@/components/Tabs';

interface Props {
  collectionId: string;
  activeMediaId?: string | null;
  className?: string;
}

// Wrapper around existing CommentThread to combine collection + current media discussions.
export const CollectionCommentsPanel: React.FC<Props> = ({ collectionId, activeMediaId, className = '' }) => {
  const [tab, setTab] = useState<'All' | 'Collection' | 'Item'>('All');
  const showItem = Boolean(activeMediaId);
  const tabs: string[] = ['All', 'Collection', ...(showItem ? ['Item'] : [])];

  return (
    <div className={`w-full ${className}`}>      
      <Tabs tabs={tabs} activeTab={tab} onTabChange={(t) => setTab(t as any)} />
      <div className="mt-4 space-y-8">
        {tab === 'All' && (
          <div className="space-y-10">
            <div>
              <h3 className="text-sm font-semibold mb-2 tracking-wide uppercase text-gray-600 dark:text-gray-400">Collection Comments</h3>
              <CommentThread targetType="COLLECTION" targetId={collectionId} />
            </div>
            {showItem && (
              <div>
                <h3 className="text-sm font-semibold mb-2 tracking-wide uppercase text-gray-600 dark:text-gray-400">Item Comments</h3>
                <CommentThread targetType="COLLECTION_MEDIA" targetId={activeMediaId!} />
              </div>
            )}
          </div>
        )}
        {tab === 'Collection' && (
          <CommentThread targetType="COLLECTION" targetId={collectionId} />
        )}
        {tab === 'Item' && showItem && (
          <CommentThread targetType="COLLECTION_MEDIA" targetId={activeMediaId!} />
        )}
      </div>
    </div>
  );
};

export default CollectionCommentsPanel;
