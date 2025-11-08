import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { brandApi } from '@/api/BrandApi';
import type { BrandProfileDto, CollectionDto } from '@/types/profile';
import CollectionsGrid from '@/components/profile/CollectionsGrid';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import AccessApi from '@/api/AccessApi';
import { FrostedButton } from '@/components/ui/FrostedButton';
import SegmentChips from '@/components/ui/SegmentChips';
import { toast } from 'react-toastify';

const BrandPublic: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [brand, setBrand] = React.useState<BrandProfileDto | null>(null);
  const [collections, setCollections] = React.useState<CollectionDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<'Public' | 'Private'>('Public');
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const [inviteToken, setInviteToken] = React.useState('');

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
    return () => {
      mounted = false;
    };
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
              {brand.logoImage ? (
                <img
                  src={brand.logoImage}
                  alt={brand.brandFullName || 'Brand'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-bold">
                  {(brand.brandFullName || 'B').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <div className="text-lg font-semibold">{brand.brandFullName || 'Brand'}</div>
            </div>
          </div>

          <div className="mb-4">
            <SegmentChips
              options={[{ key: 'Public', label: 'Public' }, { key: 'Private', label: 'Private' }]}
              value={activeTab}
              onChange={(k) => setActiveTab(k as 'Public' | 'Private')}
              ariaLabel="Visibility filter"
            />
          </div>

          {activeTab === 'Public' ? (
            <CollectionsGrid
              collections={collections}
              onCollectionClick={(cid) => navigate(`/collections/${cid}`)}
            />
          ) : (
            <div className="glass-panel border border-white/30 bg-white/10 backdrop-blur-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-2">Private Collections</h3>
              {!isAuth ? (
                <p className="text-white/80 text-sm">
                  Sign in to request or accept access to private collections.
                </p>
              ) : (
                <>
                  <p className="text-white/80 text-sm mb-4">
                    Private collections require approval. Visit a specific collection page to request
                    access, or accept an invite below if you have one.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Paste invite token here"
                      className="flex-1 rounded-md bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder-white/60"
                      value={inviteToken}
                      onChange={(e) => setInviteToken(e.target.value)}
                    />
                    <FrostedButton
                      size="sm"
                      variant="primary"
                      onClick={async () => {
                        if (!inviteToken.trim()) return;
                        try {
                          const res = await AccessApi.acceptInvite(inviteToken.trim());
                          if (res?.success) {
                            toast.success('Invite accepted');
                          } else {
                            toast.error('Could not accept invite');
                          }
                        } catch (e) {
                          toast.error('Could not accept invite');
                        }
                      }}
                    >
                      Accept Invite
                    </FrostedButton>
                  </div>
                  <p className="text-xs text-white/60 mt-2">
                    Or open an invite link directly: it looks like /collections/invite?token=...
                  </p>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BrandPublic;

