import { configureStore } from '@reduxjs/toolkit';
import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EssentialsPage from '@/pages/studio/shop/ShopSetupEssentialsPage';
import WizardPage from '@/pages/studio/shop/ShopSetupWizardPage';
import StoreEssentials from '@/pages/store/StoreEssentials';
import { queryClient } from '@/query/queryClient';
import userReducer from '@/features/userSlice';
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
const fixture = vi.hoisted(() => ({ complete: false }));
vi.mock('@/api/StoreApi', () => ({ getStoreStatus: async () => ({ isStoreOpen: true, isPublished: true, isSetupComplete: fixture.complete }),
  getStoreWizardPrefill: async () => ({ flags: { hasLiveStore: true }, brand: { description: 'Published brand repair details.', tagline: 'Repair form' } }), updateStoreProfile: vi.fn() }));
vi.mock('@/components/studio/StudioScaffold', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('@/pages/store/StoreCreationWizard', () => ({ default: () => <div>Repair wizard</div> }));
function mount(component: React.ReactNode) {
 const store = configureStore({ reducer: { user: userReducer }, preloadedState: { user: { isAuthenticated: true,
   profile: { id: 'owner', type: 'BRAND', activeBrandId: 'brand', brandMemberships: [{ brandId: 'brand', role: 'OWNER', status: 'ACTIVE' }], brandFullName: 'Fixture' } as never } } });
 return render(<Provider store={store}><QueryClientProvider client={queryClient}><MemoryRouter initialEntries={['/setup']}><Routes><Route path="/setup" element={component}/><Route path="/studio/store" element={<div>Completed Studio</div>}/></Routes></MemoryRouter></QueryClientProvider></Provider>);
}
beforeEach(() => { fixture.complete = false; queryClient.clear(); });
afterEach(() => { cleanup(); queryClient.clear(); });
describe('published stores can repair incomplete setup', () => {
 it('keeps the essentials wrapper available even when the store is live', async () => { mount(<EssentialsPage/>); expect(await screen.findByDisplayValue('Repair form')).toBeInTheDocument(); expect(screen.queryByText('Completed Studio')).toBeNull(); });
 it('keeps the wizard available for a live incomplete store', async () => { mount(<WizardPage/>); expect(await screen.findByText('Repair wizard')).toBeInTheDocument(); expect(screen.queryByText('Completed Studio')).toBeNull(); });
 it('keeps direct essentials available despite the old live-store flag', async () => { mount(<StoreEssentials/>); expect(await screen.findByDisplayValue('Repair form')).toBeInTheDocument(); expect(screen.queryByText('Completed Studio')).toBeNull(); });
 it('redirects a genuinely completed store instead of restarting its wizard', async () => { fixture.complete = true; mount(<WizardPage/>); expect(await screen.findByText('Completed Studio')).toBeInTheDocument(); });
});
