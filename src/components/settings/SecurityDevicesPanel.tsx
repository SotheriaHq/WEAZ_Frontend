import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SecuritySessionsApi, type SecurityDevice } from '@/api/SecuritySessionsApi';

const action = 'rounded-xl bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary shadow-sm disabled:opacity-50';
function DeviceCard({ device, actorId }: { device: SecurityDevice; actorId: string }) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const client = useQueryClient();
  const root = ['auth', 'security-devices', actorId];
  const sessions = useQuery({ queryKey: [...root, 'sessions', device.key, cursor], enabled: open,
    queryFn: ({ signal }) => SecuritySessionsApi.sessions(device.key, cursor, signal), staleTime: 30_000 });
  const revoke = useMutation({
    mutationFn: (id?: string) => id ? SecuritySessionsApi.revokeSession(id) : SecuritySessionsApi.revokeDevice(device.key),
    onSuccess: () => client.invalidateQueries({ queryKey: root }),
  });
  const confirm = (id?: string) => {
    const message = id ? 'Sign out this session? Its existing access token will stop working.' : device.isCurrentDevice
      ? 'Sign out the other sessions on this installation? Your current session and its Studio source stay signed in.'
      : 'Sign out all sessions on this installation, including Studio?';
    if (window.confirm(message)) revoke.mutate(id);
  };
  return <div className="space-y-3 py-4">
    <h3 className="text-base font-semibold">{device.key === 'unidentified' ? 'Earlier devices — unidentified' : device.deviceName ?? 'App or browser installation'}</h3>
    <p className="text-sm text-gray-500 dark:text-gray-400">{device.isCurrentDevice ? 'This installation · ' : ''}{device.activeSessionCount} active · {device.sessionCount} recent sessions · Last active {new Date(device.lastUsedAt).toLocaleString()}</p>
    <div className="flex flex-wrap gap-3">
      <button type="button" className={action} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide sessions' : 'View sessions'}</button>
      <button type="button" className={action} disabled={revoke.isPending} onClick={() => confirm()}>{device.isCurrentDevice ? 'Sign out other sessions here' : 'Sign out this device'}</button>
    </div>
    {revoke.isError ? <p role="alert">Sign-out failed. Please retry.</p> : null}
    {open ? <div className="space-y-4 pl-4">
      {sessions.isLoading ? <p role="status">Loading sessions…</p> : null}
      {sessions.isError ? <button type="button" className={action} onClick={() => { void sessions.refetch(); }}>Retry sessions</button> : null}
      {sessions.data?.items.map((session) => <div key={session.id} className="space-y-2 py-2">
        <p className="font-semibold">{session.context}{session.isCurrentSession ? ' · Current session' : ''}</p>
        <p className="text-sm">{session.isActive ? 'Active' : session.endedReason === 'SECURITY_UPGRADE' ? 'Ended during security upgrade' : 'Signed out or expired'}{session.isCurrentSource ? ' · Source for this Studio session' : ''}{session.ipAddressMasked ? ` · Network ${session.ipAddressMasked}` : ''}</p>
        <p className="text-sm">Signed in {new Date(session.createdAt).toLocaleString()} · Last active {new Date(session.lastUsedAt ?? session.createdAt).toLocaleString()}</p>
        {!session.isCurrentSession && !session.isCurrentSource && session.isActive ? <button type="button" className={action} disabled={revoke.isPending} onClick={() => confirm(session.id)}>Sign out session</button> : null}
      </div>)}
      {sessions.data?.nextCursor ? <button type="button" className={action} onClick={() => setCursor(sessions.data!.nextCursor)}>Older sessions</button> : null}
      {cursor ? <button type="button" className={action} onClick={() => setCursor(null)}>Newest sessions</button> : null}
    </div> : null}
  </div>;
}

export function SecurityDevicesPanel({ actorId }: { actorId: string }) {
  const [cursor, setCursor] = useState<string | null>(null);
  const client = useQueryClient();
  const root = ['auth', 'security-devices', actorId];
  const devices = useQuery({ queryKey: [...root, 'devices', cursor], enabled: Boolean(actorId),
    queryFn: ({ signal }) => SecuritySessionsApi.devices(cursor, signal), staleTime: 30_000 });
  const revoke = useMutation({ mutationFn: SecuritySessionsApi.revokeOthers,
    onSuccess: () => client.invalidateQueries({ queryKey: root }) });
  return <div className="space-y-4">
    <p className="text-sm text-gray-500 dark:text-gray-400">One entry per app installation or browser profile. Expand a device to inspect its sessions. Labels help you recognise a device; they do not prove its identity.</p>
    <button type="button" className={action} disabled={revoke.isPending} onClick={() => {
      if (window.confirm('Sign out all other sessions? Your current session and its Studio source stay signed in.')) revoke.mutate();
    }}>Sign out all other sessions</button>
    {revoke.isError ? <p role="alert">Sign-out failed. Please retry.</p> : null}
    {devices.isLoading ? <p role="status">Loading devices…</p> : null}
    {devices.isError ? <button type="button" className={action} onClick={() => { void devices.refetch(); }}>Retry devices</button> : null}
    {devices.data?.items.map((device) => <DeviceCard key={device.key} device={device} actorId={actorId} />)}
    {devices.data?.items.length === 0 ? <p>No active sessions found.</p> : null}
    {devices.data?.nextCursor ? <button type="button" className={action} onClick={() => setCursor(devices.data!.nextCursor)}>More devices</button> : null}
    {cursor ? <button type="button" className={action} onClick={() => setCursor(null)}>Most recent devices</button> : null}
  </div>;
}
