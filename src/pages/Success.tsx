import React from 'react';

const Success: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-green-500">Welcome to your profile!</h1>
        <p className="mt-4 text-lg">Your account has been created successfully.</p>
      </div>
    </div>
  );
};

export default Success;
