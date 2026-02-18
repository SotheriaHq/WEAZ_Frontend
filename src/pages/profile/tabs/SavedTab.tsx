import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/api/httpClient';
import EmptyState from '@/components/EmptyState';
import Card from '@/components/ui/Card';
import { AlertTriangle, Save } from 'lucide-react';

interface SavedItem {
  id: string;
  targetType: 'COLLECTION' | 'COLLECTION_MEDIA';
  targetId: string;
  collectionId?: string;
  title: string;
  thumbnail?: string;
  brand: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    profileImage?: string;
  };
  createdAt: string;
}

interface SavedTabProps {
  isOwner: boolean;
}

const toSavedItems = (raw: unknown): SavedItem[] => {
  const payload = (raw as { data?: unknown } | null)?.data ?? raw;
  const source = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { items?: unknown } | null)?.items)
      ? ((payload as { items: unknown[] }).items)
      : Array.isArray((payload as { savedItems?: unknown } | null)?.savedItems)
        ? ((payload as { savedItems: unknown[] }).savedItems)
        : [];

  return source
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const item = entry as Record<string, unknown>;
      const brand = (item.brand as Record<string, unknown> | undefined) ?? {};
      const id = String(item.id ?? '');
      const targetId = String(item.targetId ?? '');
      if (!id || !targetId) return null;

      return {
        id,
        targetType: item.targetType === 'COLLECTION_MEDIA' ? 'COLLECTION_MEDIA' : 'COLLECTION',
        targetId,
        collectionId: item.collectionId ? String(item.collectionId) : undefined,
        title: String(item.title ?? 'Untitled'),
        thumbnail: typeof item.thumbnail === 'string' ? item.thumbnail : undefined,
        brand: {
          id: String(brand.id ?? ''),
          username: String(brand.username ?? ''),
          firstName: String(brand.firstName ?? ''),
          lastName: String(brand.lastName ?? ''),
          profileImage: typeof brand.profileImage === 'string' ? brand.profileImage : undefined,
        },
        createdAt: String(item.createdAt ?? new Date(0).toISOString()),
      } as SavedItem;
    })
    .filter((item): item is SavedItem => Boolean(item));
};

export const SavedTab: React.FC<SavedTabProps> = ({ isOwner }) => {
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSavedItems = async () => {
      if (!isOwner) {
        // Non-owners cannot see saved items
        setSavedItems([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await apiClient.get('/saved/me');
        setSavedItems(toSavedItems(response.data));
        setError(null);
      } catch (err) {
        setSavedItems([]);
        setError('Failed to load saved items');
        console.error('Error fetching saved items:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSavedItems();
  }, [isOwner]);

  if (!isOwner) {
    return null;
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(4)].map((_, idx) => (
          <div key={idx} className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 animate-pulse">
            <div className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg mb-3"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12">
        <EmptyState
          title="Error Loading Saved Items"
          description={error}
          icon={<AlertTriangle className="h-8 w-8 text-amber-500" />}
        />
      </div>
    );
  }

  if (savedItems.length === 0) {
    return (
      <div className="py-12">
        <EmptyState
          title="No Saved Items Yet"
          description="Save designs to revisit them later. Your saved items will appear here."
          icon={<Save className="h-8 w-8 text-indigo-500" />}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {savedItems.map((item) => (
        <Card
          key={item.id}
          className="overflow-hidden"
          onClick={() => {
            const collectionId = item.targetType === 'COLLECTION'
              ? item.targetId
              : item.collectionId;
            if (collectionId) {
              navigate(`/collections/${collectionId}`);
            }
          }}
        >
          <div className="aspect-square w-full overflow-hidden">
            {item.thumbnail ? (
              <img
                src={item.thumbnail}
                alt={item.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <span className="text-gray-500">No image</span>
              </div>
            )}
          </div>
          <div className="p-3">
            <h3 className="font-medium text-gray-900 dark:text-white truncate">{item.title}</h3>
            <div className="flex items-center mt-1">
              {item.brand.profileImage ? (
                <img
                  src={item.brand.profileImage}
                  alt={item.brand.username}
                  className="w-6 h-6 rounded-full mr-2"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600 mr-2 flex items-center justify-center">
                  <span className="text-xs text-gray-700 dark:text-gray-300">
                    {item.brand.firstName?.charAt(0) || item.brand.lastName?.charAt(0) || '?'}
                  </span>
                </div>
              )}
              <span className="text-sm text-gray-600 dark:text-gray-400 truncate">
                {[item.brand.firstName, item.brand.lastName].filter(Boolean).join(' ') || item.brand.username || 'Unknown user'}
              </span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};
