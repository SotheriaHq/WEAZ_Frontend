import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface BrandHeaderProps {
  brandName: string;
  brandUsername?: string | null;
  brandAvatar?: string | null;
  collectionTitle: string;
  onBack?: () => void;
}

export const BrandHeader: React.FC<BrandHeaderProps> = ({
  brandName,
  brandUsername,
  brandAvatar,
  collectionTitle,
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
    <div className="relative mb-6 overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-100 via-pink-50 to-purple-50 dark:from-purple-900/20 dark:via-pink-900/10 dark:to-purple-900/20 opacity-60" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.8),transparent_50%)] dark:bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.05),transparent_50%)]" />
      
      {/* Content */}
      <div className="relative px-6 py-5 flex items-center gap-4">
        {/* Back Button */}
        <button
          onClick={handleBack}
          className="flex-shrink-0 w-9 h-9 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 hover:scale-105 transition-all shadow-sm"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Brand Avatar */}
        {brandAvatar && (
          <div className="flex-shrink-0 w-12 h-12 rounded-full overflow-hidden border-2 border-white dark:border-gray-800 shadow-md">
            <img
              src={brandAvatar}
              alt={brandName}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Text Content */}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white leading-tight tracking-tight">
            {collectionTitle}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-600 dark:text-gray-400">by</span>
            <button
              onClick={() => {
                if (brandUsername) navigate(`/@${brandUsername}`);
              }}
              className="text-xs font-medium text-purple-700 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 hover:underline transition"
            >
              {brandName}
            </button>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="hidden sm:flex flex-shrink-0 items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
          <div className="w-2 h-2 rounded-full bg-pink-400 animate-pulse delay-100" />
          <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse delay-200" />
        </div>
      </div>
    </div>
  );
};

export default BrandHeader;
