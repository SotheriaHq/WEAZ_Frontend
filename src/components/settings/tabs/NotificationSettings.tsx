import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SettingsSectionHeading } from '@/components/settings/SettingsSectionHeading';
import { useNotificationSettings } from '@/notifications/useNotificationSettings';
import { getNotificationSection, PUSH_MASTER_TOGGLE, QUIET_HOURS_TOGGLE, readToggle,
  summarizeNotificationSection, visibleNotificationSections, visibleNotificationToggles,
  type NotificationToggle } from '@/notifications/notificationSections';
import { isValidQuietHour, type NotificationSettings as Settings } from '@/notifications/notificationSettings';

function Toggle({ item, settings, pending, onToggle }: {
  item: NotificationToggle; settings: Settings; pending: boolean;
  onToggle: (item: NotificationToggle, value: boolean) => void;
}) {
  const value = readToggle(settings, item);
  return <div className="flex min-w-0 items-start justify-between gap-4 py-3">
    <div className="min-w-0 flex-1 break-words">
      <p id={item.id + '-label'} className="font-medium">{item.label}</p>
      {item.description && <p id={item.id + '-description'} className="mt-1 text-sm text-gray-500 dark:text-gray-400">{item.description}</p>}
    </div>
    <button type="button" role="switch" aria-checked={value} aria-labelledby={item.id + '-label'}
      aria-describedby={item.description ? item.id + '-description' : undefined} aria-busy={pending} disabled={pending}
      onClick={() => onToggle(item, !value)} className="min-h-11 min-w-16 shrink-0 rounded-lg border-2 border-gray-300 px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 dark:border-gray-600">
      {pending ? 'Saving…' : value ? 'On' : 'Off'}
    </button>
  </div>;
}

export default function NotificationSettings() {
  const controller = useNotificationSettings();
  const { settings, loading, loadError, reload, isPending, failed, retryFailed, dismissFailure, patch } = controller;
  const [params, setParams] = useSearchParams();
  const sectionId = params.get('notificationSection');
  const section = getNotificationSection(sectionId);
  const heading = useRef<HTMLHeadingElement>(null);
  const [timeError, setTimeError] = useState<string | null>(null);
  useEffect(() => { heading.current?.focus(); setTimeError(null); }, [sectionId]);
  const open = (id: string | null) => { const next = new URLSearchParams(params);
    if (id) next.set('notificationSection', id); else next.delete('notificationSection'); setParams(next); };
  const onToggle = (item: NotificationToggle, value: boolean) => { void patch({ section: item.section, key: item.key, value }); };
  if (loading && !settings) return <p role="status">Loading notification settings…</p>;
  if (!settings) return <div role="alert"><p>{loadError ?? 'Notification settings are unavailable.'}</p>
    <button type="button" className="mt-3 min-h-11 font-semibold text-primary" onClick={reload}>Retry</button></div>;
  const pushOn = settings.push.enabled;
  const sections = visibleNotificationSections(settings).filter(item => item.id !== 'device');
  const renderToggle = (item: NotificationToggle) => <Toggle key={item.id} item={item} settings={settings} pending={isPending(item)} onToggle={onToggle} />;
  const master = { ...PUSH_MASTER_TOGGLE, description: 'Allow push notifications on phones registered with your WIEZ account. Phone permission is managed in the WIEZ app.' };
  const saveTime = (key: 'quietHoursStart' | 'quietHoursEnd', value: string) => {
    if (value && !isValidQuietHour(value)) { setTimeError('Choose a valid time.'); return; }
    setTimeError(null);
    if (value !== (settings.push[key] ?? '')) void patch({ section: 'push', key, value: value || null });
  };
  return <div className="space-y-6 text-gray-900 dark:text-white">
    {sectionId && <button type="button" onClick={() => open(null)} className="min-h-11 font-semibold text-primary">← Notification settings</button>}
    <div><h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold break-words">{section?.title ?? 'Notification settings'}</h1>
      <p className="mt-2 text-gray-500 dark:text-gray-400">{section?.description ?? 'Choose delivery options and the updates you want to receive.'}</p></div>
    {failed && <div role="alert" className="space-y-2"><p>Setting was not saved. {failed.message}</p>
      <div className="flex flex-wrap gap-4"><button type="button" className="min-h-11 font-semibold text-primary" onClick={retryFailed}>Retry</button>
        <button type="button" className="min-h-11" onClick={dismissFailure}>Dismiss</button></div></div>}
    {sectionId && (!section || section.id === 'device') ? <p role="alert">This section is unavailable here. Phone registration can be checked in the WIEZ app.</p> : section ? <section data-settings-section>
      <SettingsSectionHeading>{section.title}</SettingsSectionHeading>
      {section.requiresPush && !pushOn ? <div><p className="mt-3">Push notifications are off. Your delivery choices are kept.</p>{renderToggle(master)}</div>
      : section.id === 'quiet-hours' ? <div>{renderToggle(QUIET_HOURS_TOGGLE)}
        {settings.push.quietHoursEnabled && <div className="space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">Times use UTC. Both times are needed. Equal times pause notifications all day.</p>
          <div className="flex flex-wrap gap-4">{(['quietHoursStart', 'quietHoursEnd'] as const).map((key, index) => <label key={key} className="flex min-w-0 flex-col gap-2">
            {index === 0 ? 'Starts (UTC)' : 'Ends (UTC)'}
            <input key={settings.push[key] ?? 'unset'} type="time" defaultValue={settings.push[key] ?? ''}
              disabled={isPending({ section: 'push', key })} onBlur={event => saveTime(key, event.target.value)}
              className="min-h-11 rounded-lg border-2 border-gray-300 bg-transparent px-3 dark:border-gray-600" />
          </label>)}</div>
          {(!settings.push.quietHoursStart || !settings.push.quietHoursEnd) && <p role="status">Choose both times to apply quiet hours.</p>}
          {timeError && <p role="alert">{timeError}</p>}
        </div>}
      </div> : <div>{visibleNotificationToggles(section, settings).map(renderToggle)}</div>}
    </section> : <>
      <section data-settings-section><SettingsSectionHeading>Push delivery</SettingsSectionHeading>{renderToggle(master)}</section>
      {pushOn && <section data-settings-section><SettingsSectionHeading>Delivery options</SettingsSectionHeading>
        {sections.filter(item => item.group === 'phone').map(item => <SectionLink key={item.id} title={item.title} summary={summarizeNotificationSection(item, settings)} onClick={() => open(item.id)} />)}
      </section>}
      <section data-settings-section><SettingsSectionHeading>What you hear about</SettingsSectionHeading>
        <p className="my-3 text-sm text-gray-500 dark:text-gray-400">These choices also control your WIEZ inbox while push notifications are off. Message receipts remain separate privacy choices.</p>
        {sections.filter(item => item.group === 'topics').map(item => <SectionLink key={item.id} title={item.title} summary={summarizeNotificationSection(item, settings)} onClick={() => open(item.id)} />)}
      </section>
    </>}
  </div>;
}
function SectionLink({ title, summary, onClick }: { title: string; summary: string; onClick: () => void }) {
  return <button type="button" className="flex min-h-14 w-full items-center justify-between gap-4 py-3 text-left focus-visible:outline focus-visible:outline-2" onClick={onClick}>
    <span className="min-w-0 break-words"><span className="block font-medium">{title}</span><span className="block text-sm text-gray-500 dark:text-gray-400">{summary}</span></span><span aria-hidden="true">›</span>
  </button>;
}
