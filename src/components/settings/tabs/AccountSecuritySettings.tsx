import React from 'react';

import AccountSettings from './AccountSettings';
import SecuritySettings from './SecuritySettings';

const AccountSecuritySettings: React.FC = () => {
  return (
    <div className="space-y-8">
      <AccountSettings />
      <SecuritySettings />
    </div>
  );
};

export default AccountSecuritySettings;