import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Package } from 'lucide-react';
import MediaRenderer from '../media/MediaRenderer';

interface BrandHeaderProps {
  brandName: string;
  brandUsername?: string | null;
  brandAvatar?: string | null;
  brandBio?: string | null;
  totalCollections?: number;
  totalFollowers?: number;
  onBack?: () => void;
}

export const BrandHeader: React.FC<BrandHeaderProps> = ({
  brandName,
  brandUsername,
  brandAvatar,
  brandBio,
  totalCollections,
  totalFollowers,
  onBack,
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="relative mb-6">
      {/* Content */}
      <div className="relative px-4 sm:px-6 py-4 flex items-center gap-4">
        {/* Back Button */}
        <button
          onClick={handleBack}
          className="flex-shrink-0 w-9 h-9 rounded-lg bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 hover:scale-105 transition-all shadow-sm"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Brand Avatar - Square */}
        {brandAvatar && (
          <div className="flex-shrink-0 rounded-lg border border-gray-200 dark:border-gray-700 shadow-md">
            <MediaRenderer
              kind="image"
              src={brandAvatar}
              alt={brandName}
              maxHeightClassName="max-h-16"
              maxWidthClassName="max-w-16"
              className="rounded-lg"
              mediaClassName="rounded-lg"
            />
          </div>
        )}

        {/* Brand Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white leading-tight tracking-tight">
              {brandName}
            </h1>
            <button
              onClick={() => {
                if (brandUsername) navigate(`/@${brandUsername}`);
              }}
              className="text-xs font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:underline transition"
            >
              @{brandUsername}
            </button>
          </div>
          
          {brandBio && (
            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1 mb-2">
              {brandBio}
            </p>
          )}

          {/* Brand Stats */}
          <div className="flex items-center gap-4 text-xs">
            {typeof totalCollections === 'number' && (
              <div className="flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                <span className="font-semibold text-gray-900 dark:text-white">{totalCollections}</span>
                <span className="text-gray-500 dark:text-gray-400">collection{totalCollections !== 1 ? 's' : ''}</span>
              </div>
            )}
            {typeof totalFollowers === 'number' && (
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-gray-900 dark:text-white">{totalFollowers}</span>
                <span className="text-gray-500 dark:text-gray-400">follower{totalFollowers !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrandHeader;
