import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Store } from 'lucide-react';

interface StoreAccessButtonProps {
  hasStore: boolean;
  storeId?: string | null;
  className?: string;
}

/**
 * Store Access Button - displays on Brand profile
 * - No store: "Create Your Store" → /store/create
 * - Has store: "🏪 Store" → /store/:id
 */
const StoreAccessButton: React.FC<StoreAccessButtonProps> = ({
  hasStore,
  storeId,
  className = '',
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (hasStore && storeId) {
      navigate(`/store/${storeId}`);
    } else {
      navigate('/store/create');
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`
        inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm
        transition-all duration-200
        ${hasStore
          ? 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 text-white hover:opacity-90 shadow-lg shadow-purple-500/25'
          : 'bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-500 hover:to-purple-600 shadow-lg shadow-purple-500/25'
        }
        focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2
        dark:focus:ring-offset-gray-900
        ${className}
      `}
      aria-label={hasStore ? 'Go to your store' : 'Create your store'}
    >
      {hasStore ? (
        <>
          <span className="text-base" aria-hidden>🏪</span>
          <span>Store</span>
        </>
      ) : (
        <>
          <Store className="w-4 h-4" aria-hidden />
          <span>Create Your Store</span>
        </>
      )}
    </button>
  );
};

export default StoreAccessButton;
