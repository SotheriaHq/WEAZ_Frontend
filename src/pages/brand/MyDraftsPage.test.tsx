import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ page: vi.fn(), remove: vi.fn(), error: vi.fn(),
  listeners: new Set<() => void>(), token: '' }));
vi.mock('@/api/BrandApi', () => ({ brandApi: { getMyDraftCollectionsPage: fixture.page } }));
vi.mock('@/api/DesignApi', () => ({ deleteDesign: fixture.remove }));
vi.mock('@/api/httpClient', () => ({ getStoredAccessToken: () => fixture.token,
  subscribeAccessToken: (listener: () => void) => { fixture.listeners.add(listener); return () => fixture.listeners.delete(listener); } }));
vi.mock('sonner', () => ({ toast: { error: fixture.error, success: vi.fn() } }));
vi.mock('@/components/media/MediaRenderer', () => ({ default: () => null }));
vi.mock('@/components/ui/ConfirmDialog', () => ({ default: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
  open ? <button onClick={onConfirm}>Confirm draft deletion</button> : null }));
const cache = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
vi.mock('@/query/queryClient', () => ({ get queryClient() { return cache; } }));
import MyDraftsPage from './MyDraftsPage';

const token = (subject = '11111111-1111-4111-8111-111111111111') =>
  `e30.${btoa(JSON.stringify({ sub: subject, sid: '22222222-2222-4222-8222-222222222222', authVersion: 1, role: 'User' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}.sig`;
const draft = (id: string, title: string) => ({ id, title, description: '', createdAt: '2026-11-10T00:00:00Z', itemCount: 1 });
function mount() {
  return render(<QueryClientProvider client={cache}><MemoryRouter><MyDraftsPage /></MemoryRouter></QueryClientProvider>);
}
beforeEach(() => { fixture.page.mockReset(); fixture.remove.mockReset(); fixture.error.mockReset(); fixture.token = token(); });
afterEach(() => { cleanup(); cache.clear(); fixture.listeners.clear(); });

describe('bounded draft list interactions', () => {
  it('keeps later pages reachable while sending the signal and current identity', async () => {
    fixture.page.mockImplementation(({ cursor }) => Promise.resolve(cursor
      ? { items: [draft('second', 'Second draft')], nextCursor: null }
      : { items: [draft('first', 'First draft')], nextCursor: 'next-page' }));
    mount(); await screen.findByText('First draft');
    fireEvent.click(screen.getByRole('button', { name: 'Load more drafts' }));
    await screen.findByText('Second draft'); expect(screen.getByText('First draft')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Load more drafts' })).toBeNull();
    expect(fixture.page.mock.calls[1][0]).toMatchObject({ cursor: 'next-page', limit: 50,
      expectedIdentity: '11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222:1:User' });
    expect(fixture.page.mock.calls[1][0].signal).toBeInstanceOf(AbortSignal);
  });
  it('keeps the draft visible when deletion is rejected', async () => {
    fixture.page.mockResolvedValue({ items: [draft('first', 'Keep this draft')], nextCursor: null });
    fixture.remove.mockRejectedValue(new Error('Deletion rejected'));
    mount(); await screen.findByText('Keep this draft');
    fireEvent.click(screen.getByRole('button', { name: 'Delete Keep this draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm draft deletion' }));
    await waitFor(() => expect(fixture.error).toHaveBeenCalledWith('Failed to delete draft'));
    expect(screen.getByText('Keep this draft')).toBeTruthy(); expect(fixture.remove).toHaveBeenCalledWith('first');
  });
  it('offers retry instead of presenting a failed fetch as an empty account', async () => {
    fixture.page.mockRejectedValueOnce(new Error('Offline')).mockResolvedValue({ items: [draft('first', 'Recovered draft')], nextCursor: null });
    mount(); fireEvent.click(await screen.findByRole('button', { name: 'Retry drafts' }));
    await screen.findByText('Recovered draft'); expect(screen.queryByText('No draft designs')).toBeNull();
  });
  it('closes another session’s pending delete confirmation and never carries its cards into the next session', async () => {
    fixture.page.mockResolvedValueOnce({ items: [draft('old', 'Old session draft')], nextCursor: null })
      .mockResolvedValue({ items: [draft('new', 'New session draft')], nextCursor: null });
    mount(); await screen.findByText('Old session draft');
    fireEvent.click(screen.getByRole('button', { name: 'Delete Old session draft' }));
    expect(screen.getByRole('button', { name: 'Confirm draft deletion' })).toBeTruthy();
    fixture.token = token('33333333-3333-4333-8333-333333333333'); fixture.listeners.forEach(listener => listener());
    await screen.findByText('New session draft');
    expect(screen.queryByText('Old session draft')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Confirm draft deletion' })).toBeNull();
    expect(fixture.remove).not.toHaveBeenCalled();
  });
});
