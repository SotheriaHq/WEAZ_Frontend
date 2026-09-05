import React, { createContext, useContext } from 'react';
import { useParams } from 'react-router-dom';

type ProfileRouteContextValue = {
  profileId?: string;
  defaultTab?: string;
};

const ProfileRouteContext = createContext<ProfileRouteContextValue>({});

export const ProfileRouteProvider: React.FC<{
  profileId: string;
  defaultTab?: string;
  children: React.ReactNode;
}> = ({ profileId, defaultTab, children }) => (
  <ProfileRouteContext.Provider value={{ profileId, defaultTab }}>
    {children}
  </ProfileRouteContext.Provider>
);

export function useProfileRouteId(): string | undefined {
  const context = useContext(ProfileRouteContext);
  const { id } = useParams<{ id?: string }>();
  return context.profileId ?? id;
}

export function useProfileRouteDefaultTab(): string | undefined {
  return useContext(ProfileRouteContext).defaultTab;
}