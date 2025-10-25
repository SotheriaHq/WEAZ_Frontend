import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { brandApi } from '@/api/BrandApi';
import type { BrandProfileDto, CollectionDto } from '@/types/profile';
import CollectionsGrid from '@/components/profile/CollectionsGrid';

const BrandPublic: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [brand, setBrand] = React.useState<BrandProfileDto | null>(null);
  const [collections, setCollections] = React.useState<CollectionDto[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const b = await brandApi.getBrandProfile(id);
        const cols = await brandApi.getCollections(id);
        if (!mounted) return;
        setBrand(b);
        setCollections(cols);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void run();
    return () => { mounted = false; };
  }, [id]);

  if (!id) return null;

  return (
    <div className="max-w-6xl mx-auto">
      <button className="text-sm text-primary mb-4" onClick={() => navigate(-1)}>&larr; Back</button>
      {loading ? (
        <div className="text-sm text-gray-500">Loading brand…</div>
      ) : !brand ? (
        <div className="text-sm text-gray-500">Brand not found.</div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-white">
              {brand.profileImage ? (
                <img src={brand.profileImage} alt={brand.brandFullName || brand.username || 'Brand'} className="w-full h-full object-cover" />
              ) : (
                <span className="font-bold">{(brand.brandFullName || brand.username || 'B').charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div>
              <div className="text-lg font-semibold">{brand.brandFullName || brand.username || 'Brand'}</div>
              {brand.username && <div className="text-sm text-gray-500">@{brand.username}</div>}
            </div>
          </div>
          <CollectionsGrid collections={collections} onCollectionClick={(cid) => navigate(`/collections/${cid}`)} />
        </>
      )}
    </div>
  );
};

export default BrandPublic;

