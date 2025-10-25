import React from 'react';
import { useParams } from 'react-router-dom';

const CollectionView: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Collection</h1>
        <p className="text-gray-500">ID: {id}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {/* TODO: Render collection items */}
        <div className="col-span-full text-sm text-gray-500">Items will appear here.</div>
      </div>
    </div>
  );
};

export default CollectionView;
