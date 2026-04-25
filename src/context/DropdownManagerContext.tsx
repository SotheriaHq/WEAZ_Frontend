import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface DropdownManagerValue {
  openId: string | null;
  setOpenId: (id: string | null) => void;
  closeAll: () => void;
}

const DropdownManagerContext = createContext<DropdownManagerValue | null>(null);

export const DropdownManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [openId, setOpenId] = useState<string | null>(null);

  const closeAll = useCallback(() => setOpenId(null), []);

  const value = useMemo(
    () => ({ openId, setOpenId, closeAll }),
    [openId, closeAll],
  );

  return (
    <DropdownManagerContext.Provider value={value}>
      {children}
    </DropdownManagerContext.Provider>
  );
};

export const useDropdownManager = () => {
  const ctx = useContext(DropdownManagerContext);
  if (!ctx) {
    throw new Error('useDropdownManager must be used within DropdownManagerProvider');
  }
  return ctx;
};

export const useDropdownManagerOptional = () => useContext(DropdownManagerContext);
