import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getNotificationSettingsStore, layUnansweredSaves } from './notificationSettingsStore';
import { NotificationsApi } from '@/api/NotificationsApi';
import { queryKeys } from '@/query/queryKeys';
import type { NotificationSettings } from './notificationSettings';
const session = vi.hoisted(() => ({ identity: 'actor-a:session-a:1:User' as string | null, scope: 1 }));
vi.mock('@/api/httpClient', () => ({ getApiSecurityIdentity: () => session.identity, getApiSessionScope: () => session.scope }));
vi.mock('@/api/NotificationsApi', () => ({ NotificationsApi: { updateSettings: vi.fn(), getSettings: vi.fn() } }));
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (reason: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
let client: QueryClient;
const key = queryKeys.notifications.settings('actor-a');
const base = { social: { threads: true }, comments: { replies: true } } as NotificationSettings;
beforeEach(() => { vi.clearAllMocks(); session.identity = 'actor-a:session-a:1:User'; session.scope = 1; client = new QueryClient(); client.setQueryData(key, base); });
afterEach(() => client.clear());
describe('notification settings session-bound store', () => {
  it('serializes edits and preserves the later optimistic switch under an earlier answer', async () => {
    const first = deferred<NotificationSettings>(), second = deferred<NotificationSettings>();
    vi.mocked(NotificationsApi.updateSettings).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const store = getNotificationSettingsStore(client, 'actor-a');
    const a = store.save({ section: 'social', key: 'threads', value: false });
    const b = store.save({ section: 'comments', key: 'replies', value: false });
    await flush(); expect(NotificationsApi.updateSettings).toHaveBeenCalledTimes(1);
    first.resolve({ ...base, social: { ...base.social, threads: false } }); await a;
    expect(layUnansweredSaves(client.getQueryData(key)!, store.snapshot().pending).comments.replies).toBe(false);
    await flush(); second.resolve({ ...base, comments: { ...base.comments, replies: false } }); expect(await b).toBe(true);
  });
  it('rolls back only the failed edit, keeps the next edit and retries the exact failed patch', async () => {
    const first = deferred<NotificationSettings>(), second = deferred<NotificationSettings>();
    vi.mocked(NotificationsApi.updateSettings).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise).mockResolvedValue(base);
    const store = getNotificationSettingsStore(client, 'actor-a');
    const a = store.save({ section: 'social', key: 'threads', value: false });
    const b = store.save({ section: 'comments', key: 'replies', value: false });
    await flush(); first.reject(new Error('Offline')); expect(await a).toBe(false);
    const view = layUnansweredSaves(client.getQueryData(key)!, store.snapshot().pending);
    expect(view.social.threads).toBe(true); expect(view.comments.replies).toBe(false);
    await flush(); second.resolve(base); await b; store.retry(); await flush();
    expect(NotificationsApi.updateSettings).toHaveBeenLastCalledWith({ social: { threads: false } }, expect.objectContaining({ _authScope: 1 }));
  });
  it('cancels queued, late and retried actions on A→B→A or sign-out', async () => {
    const first = deferred<NotificationSettings>(); vi.mocked(NotificationsApi.updateSettings).mockReturnValue(first.promise);
    const store = getNotificationSettingsStore(client, 'actor-a');
    const a = store.save({ section: 'social', key: 'threads', value: false });
    const b = store.save({ section: 'comments', key: 'replies', value: false }); await flush();
    session.identity = 'actor-b:session-b:1:User'; session.scope++;
    expect(getNotificationSettingsStore(client, 'actor-b').snapshot().pending).toHaveLength(0);
    first.resolve({ ...base, social: { ...base.social, threads: false } });
    expect(await a).toBe(false); expect(await b).toBe(false); expect(client.getQueryData(key)).toEqual(base);
    session.identity = 'actor-a:session-a:1:User'; session.scope++;
    store.retry(); expect(await store.save({ section: 'social', key: 'threads', value: false })).toBe(false);
    expect(NotificationsApi.updateSettings).toHaveBeenCalledTimes(1);
    session.identity = null; session.scope++;
    expect(await getNotificationSettingsStore(client, 'actor-a').save({ section: 'social', key: 'threads', value: false })).toBe(false);
  });
  it('cancels an older refresh so it cannot overwrite a saved switch', async () => {
    const oldRead = deferred<NotificationSettings>();
    const refresh = client.fetchQuery({ queryKey: key, queryFn: () => oldRead.promise }).catch(() => undefined);
    const saved = { ...base, social: { ...base.social, threads: false } };
    vi.mocked(NotificationsApi.updateSettings).mockResolvedValue(saved);
    expect(await getNotificationSettingsStore(client, 'actor-a').save({ section: 'social', key: 'threads', value: false })).toBe(true);
    oldRead.resolve(base); await refresh; await flush(); expect(client.getQueryData(key)).toEqual(saved);
  });
  it('passes normal session admission without bypassing refresh or MFA', async () => {
    vi.mocked(NotificationsApi.updateSettings).mockResolvedValue(base);
    const store = getNotificationSettingsStore(client, 'actor-a');
    expect(getNotificationSettingsStore(client, 'actor-a')).toBe(store);
    await store.save({ section: 'social', key: 'threads', value: false });
    const config = vi.mocked(NotificationsApi.updateSettings).mock.calls[0][1]!;
    expect(config).toEqual({ _authScope: 1, _securityIdentity: session.identity }); expect(config).not.toHaveProperty('_accountToken');
  });
  it('rejects mismatched manual reads and retired-session responses before caching', async () => {
    const read = deferred<NotificationSettings>(); vi.mocked(NotificationsApi.getSettings).mockReturnValue(read.promise);
    const store = getNotificationSettingsStore(client, 'actor-a');
    const pending = store.load();
    await expect(getNotificationSettingsStore(client, 'wrong-account').load()).rejects.toThrow('sign-in session changed');
    expect(NotificationsApi.getSettings).toHaveBeenCalledTimes(1);
    expect(getNotificationSettingsStore(client, 'actor-a')).toBe(store); // A stale observer cannot replace this queue.
    session.scope++; read.resolve(base); await expect(pending).rejects.toThrow('sign-in session changed');
  });

});
