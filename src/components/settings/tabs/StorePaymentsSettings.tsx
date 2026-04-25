import React from 'react';
import BrandWalletPanel from '@/components/store/BrandWalletPanel';
import StorePaymentAccountPanel from '@/components/store/StorePaymentAccountPanel';

const StorePaymentsSettings: React.FC = () => {
  return (
    <div className="space-y-6">
      <BrandWalletPanel />
      <StorePaymentAccountPanel mode="settings" />
    </div>
  );
};

export default StorePaymentsSettings;
