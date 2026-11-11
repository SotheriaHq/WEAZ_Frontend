import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SecuritySessionsApi, captureSessionAuthority, type SecurityDevice, type SecuritySessionAuthority } from '@/api/SecuritySessionsApi';
import { getApiSecurityIdentity } from '@/api/httpClient';
import Modal from '@/components/ui/Modal';
import { SettingsSectionHeading } from './SettingsSectionHeading';
import { useOverlayBackClose } from '@/hooks/useOverlayBackClose';

const action = 'rounded-xl bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary shadow-sm disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
const deviceName = (device: SecurityDevice) => device.key === 'unidentified'
  ? 'Earlier devices — unidentified' : device.deviceName?.trim() || 'App or browser installation';
function DeviceCard({ device, authority }: { device: SecurityDevice; authority: SecuritySessionAuthority }) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const client = useQueryClient();
  const root = ['auth', 'security-devices', authority.actorId];
  const sessions = useQuery({ queryKey: [...root, authority.identity, 'sessions', device.key, cursor], enabled: open,
    queryFn: ({ signal }) => SecuritySessionsApi.sessions(authority, device.key, cursor, signal), staleTime: 30_000 });
  const { refetch } = sessions;
  useEffect(() => { if (open) void refetch(); }, [open, refetch]);
  const revoke = useMutation({
    mutationFn: ({ id, scope }: { id?: string; scope: SecuritySessionAuthority }) => id
      ? SecuritySessionsApi.revokeSession(scope, id) : SecuritySessionsApi.revokeDevice(scope, device.key),
    onSuccess: () => client.invalidateQueries({ queryKey: root }),
  });
  const confirm = (id?: string) => {
    const scope = authority;
    if (!mounted.current || getApiSecurityIdentity() !== scope.identity) return;
    const message = id ? 'Sign out this session? Its existing access token will stop working.' : device.isCurrentDevice
      ? 'Sign out the other sessions on this installation? Your current session and its Studio source stay signed in.'
      : 'Sign out all sessions on this installation, including Studio?';
    if (window.confirm(message) && mounted.current && getApiSecurityIdentity() === scope.identity)
      revoke.mutate({ id, scope });
  };
  const close = () => setOpen(false);
  useOverlayBackClose(open, close);
  const active = sessions.data?.items.filter(session => session.isActive) ?? [];
  const history = sessions.data?.items.filter(session => !session.isActive) ?? [];
  return <div className="min-w-0 space-y-3 break-words py-4">
    <h3 className="text-base font-semibold">{deviceName(device)}</h3>
    <p className="text-sm text-gray-500 dark:text-gray-400">{device.isCurrentDevice ? 'This installation · ' : ''}{device.activeSessionCount} active · {device.sessionCount} recent sessions · Last active {new Date(device.lastUsedAt).toLocaleString()}</p>
    <div className="flex flex-wrap gap-3">
      <button type="button" className={action} aria-haspopup="dialog" aria-expanded={open} onClick={() => {
        if (getApiSecurityIdentity() === authority.identity) { setCursor(null); setOpen(true); }
      }}>View sessions</button>
      <button type="button" className={action} disabled={revoke.isPending} onClick={() => confirm()}>{device.isCurrentDevice ? 'Sign out other sessions here' : 'Sign out this device'}</button>
    </div>
    {revoke.isError && !open ? <p role="alert">Sign-out failed. Please retry.</p> : null}
    <Modal open={open} onClose={close} title="Device sessions" size="md">
      <div className="min-w-0 space-y-5 break-words">
        <p className="font-semibold">{deviceName(device)}</p>
        <p>Inspect active sessions and sign-in history from the last 30 days for this installation. Device labels help you recognise it; they are not proof of identity.</p>
        {sessions.isPending ? <p role="status">Loading sessions…</p> : null}
        {sessions.isError ? <div role="alert" className="space-y-3"><p>Sessions could not be refreshed. Try again.</p><button type="button" className={action} onClick={() => { void refetch(); }}>Retry sessions</button></div> : null}
        {revoke.isError ? <p role="alert">Sign-out failed. Please retry.</p> : null}
        {sessions.data ? <>
          <section className="space-y-3" aria-label="Active sessions">
            <SettingsSectionHeading>Active sessions</SettingsSectionHeading>
            {active.length ? active.map(session => <div key={session.id} className="space-y-2 py-2">
              <p className="font-semibold">{session.context}{session.isCurrentSession ? ' · Current session' : ''}</p>
              <p className="text-sm">Active{session.isCurrentSource ? ' · Source for this Studio session' : ''}{session.ipAddressMasked ? ' · Network ' + session.ipAddressMasked : ''}</p>
              <p className="text-sm">Signed in {new Date(session.createdAt).toLocaleString()} · Last active {new Date(session.lastUsedAt ?? session.createdAt).toLocaleString()}</p>
              {!session.isCurrentSession && !session.isCurrentSource ? <button type="button" className={action} disabled={revoke.isPending} onClick={() => confirm(session.id)}>Sign out session</button> : null}
            </div>) : <p>No active sessions on this page.</p>}
          </section>
          <section className="space-y-3" aria-label="Recent sign-in history">
            <SettingsSectionHeading>Recent sign-in history</SettingsSectionHeading>
            {history.length ? history.map(session => <div key={session.id} className="space-y-2 py-2">
              <p className="font-semibold">{session.context}</p>
              <p className="text-sm">{session.endedReason === 'SECURITY_UPGRADE' ? 'Ended during security upgrade' : 'Signed out or expired'}{session.ipAddressMasked ? ' · Network ' + session.ipAddressMasked : ''}</p>
              <p className="text-sm">Signed in {new Date(session.createdAt).toLocaleString()} · Last active {new Date(session.lastUsedAt ?? session.createdAt).toLocaleString()}</p>
            </div>) : <p>No recent sign-in history on this page.</p>}
          </section>
        </> : null}
        <div className="flex flex-wrap gap-3">
          {sessions.data?.nextCursor ? <button type="button" className={action} onClick={() => setCursor(sessions.data!.nextCursor)}>Older sessions</button> : null}
          {cursor ? <button type="button" className={action} onClick={() => setCursor(null)}>Newest sessions</button> : null}
          <button type="button" className={action} onClick={close}>Close sessions</button>
        </div>
      </div>
    </Modal>
  </div>;
}

export function SecurityDevicesPanel({ actorId }: { actorId: string }) {
  const [cursor, setCursor] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const authority = captureSessionAuthority(actorId);
  const client = useQueryClient();
  const root = ['auth', 'security-devices', actorId];
  const devices = useQuery({ queryKey: [...root, authority?.identity ?? null, 'devices', cursor], enabled: Boolean(authority),
    queryFn: ({ signal }) => SecuritySessionsApi.devices(authority, cursor, signal), staleTime: 30_000 });
  const revoke = useMutation({ mutationFn: (scope: SecuritySessionAuthority) => SecuritySessionsApi.revokeOthers(scope),
    onSuccess: () => client.invalidateQueries({ queryKey: root }) });
  return <div className="space-y-4">
    <p className="text-sm text-gray-500 dark:text-gray-400">One entry per app installation or browser profile. View a device’s sessions in a separate window. Labels help you recognise a device; they do not prove its identity.</p>
    <button type="button" className={action} disabled={revoke.isPending || !authority} onClick={() => {
      const scope = authority;
      if (scope && getApiSecurityIdentity() === scope.identity &&
        window.confirm('Sign out all other sessions? Your current session and its Studio source stay signed in.') &&
        mounted.current && getApiSecurityIdentity() === scope.identity) revoke.mutate(scope);
    }}>Sign out all other sessions</button>
    {revoke.isError ? <p role="alert">Sign-out failed. Please retry.</p> : null}
    {devices.isLoading ? <p role="status">Loading devices…</p> : null}
    {devices.isError ? <button type="button" className={action} onClick={() => { void devices.refetch(); }}>Retry devices</button> : null}
    {authority ? devices.data?.items.map(device => <DeviceCard key={authority.identity + ':' + device.key} device={device} authority={authority} />) : null}
    {devices.data?.items.length === 0 ? <p>No recent device sessions found.</p> : null}
    {devices.data?.nextCursor ? <button type="button" className={action} onClick={() => setCursor(devices.data!.nextCursor)}>More devices</button> : null}
    {cursor ? <button type="button" className={action} onClick={() => setCursor(null)}>Most recent devices</button> : null}
  </div>;
}
