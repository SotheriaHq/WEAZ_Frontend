import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import InlineCollectionViewer from '@/components/collections/InlineCollectionViewer';

const CollectionView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) return null;

  return (
    <div className="min-h-screen w-full bg-gray-50 dark:bg-black pt-20 pb-10">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6">
        <InlineCollectionViewer
          collectionId={id}
          onBack={() => navigate(-1)}
        />
      </div>
    </div>
  );
};

export default CollectionView;
