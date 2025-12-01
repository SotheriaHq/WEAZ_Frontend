import React from 'react';
import { FrostedButton } from '@/components/ui/FrostedButton';
import { useNavigate } from 'react-router-dom';

const MarketPlace: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
      <div className="text-6xl mb-6 animate-bounce">🚧</div>
      <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
        Market is Under Construction
      </h1>
      <p className="text-lg text-gray-600 dark:text-gray-400 max-w-md mb-8">
        We are building something amazing for you. The new Market experience will be available soon!
      </p>
      <div className="flex gap-4">
        <FrostedButton onClick={() => navigate('/')}>
          Go Home
        </FrostedButton>
      </div>
    </div>
  );
};

export default MarketPlace;
