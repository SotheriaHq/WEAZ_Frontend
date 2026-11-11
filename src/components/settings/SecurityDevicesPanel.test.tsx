import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SecurityDevicesPanel } from './SecurityDevicesPanel';
import { SecuritySessionsApi, type DeviceSession } from '@/api/SecuritySessionsApi';
const state = vi.hoisted(() => ({ identity: 'actor:session:1:User' }));
vi.mock('@/api/httpClient', () => ({ apiClient: {}, getApiSecurityIdentity: () => state.identity }));
vi.mock('@/api/SecuritySessionsApi', async original => ({ ...await original<typeof import('@/api/SecuritySessionsApi')>(),
  SecuritySessionsApi: { devices: vi.fn(), sessions: vi.fn(), revokeDevice: vi.fn(), revokeSession: vi.fn(), revokeOthers: vi.fn() } }));
const when = '2026-11-11T00:00:00.000Z';
const device = { key: 'a'.repeat(64), deviceName: 'Galaxy A17', sessionCount: 2, activeSessionCount: 1, lastUsedAt: when, isCurrentDevice: true };
const active: DeviceSession = { id: '11111111-1111-4111-8111-111111111111', userAgent: null, deviceName: device.deviceName,
  createdAt: when, lastUsedAt: when, expiresAt: '2026-11-12T00:00:00.000Z', isCurrentSession: false, isCurrentSource: false,
  isActive: true, ipAddressMasked: '192.0.*.*', endedAt: null, endedReason: null, context: 'Sign-in' };
const ended = { ...active, id: '22222222-2222-4222-8222-222222222222', isActive: false, endedAt: when, endedReason: 'SIGN_OUT', context: 'Studio' as const };
beforeEach(() => {
  vi.resetAllMocks(); state.identity = 'actor:session:1:User';
  vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
  vi.mocked(SecuritySessionsApi.devices).mockResolvedValue({ items: [device], nextCursor: null });
  vi.mocked(SecuritySessionsApi.sessions).mockResolvedValue({ items: [active, ended], nextCursor: null });
});
function show(actorId = 'actor') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(<MemoryRouter><QueryClientProvider client={client}><SecurityDevicesPanel actorId={actorId} /></QueryClientProvider></MemoryRouter>);
  return { ...view, client };
}
async function open() { fireEvent.click(await screen.findByRole('button', { name: 'View sessions' })); return screen.findByRole('dialog', { name: 'Device sessions' }); }
describe('device session modal', () => {
  it('focuses the mounted portal, traps Tab and closes with Escape then restores the trigger', async () => {
    show(); const trigger = await screen.findByRole('button', { name: 'View sessions' });
    trigger.focus(); const modal = await open();
    await waitFor(() => expect(modal.contains(document.activeElement)).toBe(true));
    const close = within(modal).getByRole('button', { name: 'Close sessions' }); close.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(within(modal).getByRole('button', { name: 'Close modal' }));
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });
  it('loads details only after opening and keeps active/history sections inside the modal', async () => {
    show(); await screen.findByText('Galaxy A17');
    expect(SecuritySessionsApi.sessions).not.toHaveBeenCalled(); expect(screen.queryByRole('dialog')).toBeNull();
    const modal = await open();
    expect(await within(modal).findByRole('heading', { name: 'Active sessions' })).toBeVisible();
    expect(within(modal).getByRole('heading', { name: 'Recent sign-in history' })).toBeVisible();
    expect(within(modal).getAllByRole('button', { name: 'Sign out session' })).toHaveLength(1);
    expect(within(modal).getByText('Studio')).toBeVisible();
    fireEvent.click(within(modal).getByRole('button', { name: 'Close sessions' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByText('Studio')).toBeNull(); expect(screen.getByText('Galaxy A17')).toBeVisible();
  });
  it('shows loading then recoverable error without false empty sections', async () => {
    let reject!: (error: Error) => void;
    vi.mocked(SecuritySessionsApi.sessions).mockImplementation(() => new Promise((_resolve, fail) => { reject = fail; }));
    show(); const modal = await open(); expect(within(modal).getByRole('status')).toHaveTextContent('Loading sessions');
    expect(within(modal).queryByText('No active sessions on this page.')).toBeNull();
    await act(async () => reject(new Error('offline')));
    expect(await within(modal).findByRole('alert')).toHaveTextContent('could not be refreshed');
    vi.mocked(SecuritySessionsApi.sessions).mockResolvedValue({ items: [], nextCursor: null });
    fireEvent.click(within(modal).getByRole('button', { name: 'Retry sessions' }));
    expect(await within(modal).findByText('No active sessions on this page.')).toBeVisible();
    expect(within(modal).getByText('No recent sign-in history on this page.')).toBeVisible();
  });
  it('preserves older/newest paging and reopens at the newest page', async () => {
    vi.mocked(SecuritySessionsApi.sessions).mockImplementation(async (_scope, _device, cursor) => cursor
      ? { items: [ended], nextCursor: null } : { items: [active], nextCursor: 'older-page' });
    show(); let modal = await open(); fireEvent.click(await within(modal).findByRole('button', { name: 'Older sessions' }));
    expect(await within(modal).findByText('No active sessions on this page.')).toBeVisible();
    expect(SecuritySessionsApi.sessions).toHaveBeenLastCalledWith({ actorId: 'actor', identity: state.identity }, device.key, 'older-page', expect.any(AbortSignal));
    fireEvent.click(within(modal).getByRole('button', { name: 'Close sessions' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    modal = await open(); expect(await within(modal).findByRole('button', { name: 'Older sessions' })).toBeVisible();
    expect(within(modal).getByText('No recent sign-in history on this page.')).toBeVisible();
  });
  it('Back closes the modal without navigating the underlying screen', async () => {
    show(); await open(); const path = window.location.pathname;
    window.history.replaceState({}, '', window.location.href); fireEvent.popState(window);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(window.location.pathname).toBe(path); expect(screen.getByRole('button', { name: 'View sessions' })).toBeVisible();
  });
  it('does not navigate backward when a new route removes the modal', async () => {
    const view = show(); await open();
    window.history.pushState({ destination: 'login' }, '', '/login');
    view.unmount(); await act(async () => undefined);
    expect(window.history.back).not.toHaveBeenCalled(); expect(window.location.pathname).toBe('/login');
  });
  it('does not dispatch a confirmation after the credential or account changes', async () => {
    show(); const modal = await open(); const button = await within(modal).findByRole('button', { name: 'Sign out session' });
    vi.spyOn(window, 'confirm').mockImplementation(() => { state.identity = 'next-account:new-session:1:User'; return true; });
    fireEvent.click(button); expect(SecuritySessionsApi.revokeSession).not.toHaveBeenCalled();
    expect(SecuritySessionsApi.revokeDevice).not.toHaveBeenCalled();
  });
  it('keeps current/source sessions protected and confirms a selected active session with its original authority', async () => {
    vi.mocked(SecuritySessionsApi.sessions).mockResolvedValue({ items: [active, { ...active, id: ended.id, isCurrentSession: true },
      { ...active, id: '33333333-3333-4333-8333-333333333333', isCurrentSource: true }], nextCursor: null });
    vi.mocked(SecuritySessionsApi.revokeSession).mockResolvedValue(); vi.spyOn(window, 'confirm').mockReturnValue(true);
    show(); const modal = await open(); const buttons = await within(modal).findAllByRole('button', { name: 'Sign out session' });
    expect(buttons).toHaveLength(1); fireEvent.click(buttons[0]);
    await waitFor(() => expect(SecuritySessionsApi.revokeSession).toHaveBeenCalledWith({ actorId: 'actor', identity: state.identity }, active.id));
  });
});
