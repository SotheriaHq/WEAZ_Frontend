import { getFriendlyErrorMessage } from '@/utils/errorMessage';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { adminOrderQueueApi, type QueueTier } from '@/api/CustomOrderQueueApi';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import UniversalSelect from '@/components/forms/UniversalSelect';
import { useQueueConfirm } from '@/components/custom-orders/useQueueConfirm';

const inputClass = 'w-full min-w-0 rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white';
const panelClass = 'queue-section text-slate-900 dark:text-white';
const collection = <T,>(value: T[] | Record<string, T[]> | undefined, key: string): T[] => Array.isArray(value) ? value : value?.[key] ?? [];
function TierEditor({ tier, canEdit, canPrice, onSaved }: { tier: QueueTier; canEdit: boolean; canPrice: boolean; onSaved: () => Promise<unknown> }) {
  const [active, setActive] = useState(String(tier.maxActive ?? ''));
  const [delivery, setDelivery] = useState(String(tier.maxInDelivery ?? ''));
  const [price, setPrice] = useState(String(tier.monthlyPriceNgn));
  const [busy, setBusy] = useState(false);
  const { confirm, ConfirmDialog } = useQueueConfirm();
  const legacy = tier.tierKey === 'LEGACY';
  async function save() {
    if (!(await confirm({ title: `Update ${tier.label ?? tier.tierKey}?`, message: 'New prices apply to new subscription agreements. Existing locked prices are preserved. Capacity reductions preserve existing work and pause further admissions until capacity is available.', confirmText: 'Save tier' }))) return;
    setBusy(true);
    try { await adminOrderQueueApi.updateTier(tier.tierKey, { maxActive: Number(active), maxInDelivery: Number(delivery), expectedUpdatedAt: tier.updatedAt, ...(canPrice ? { monthlyPriceNgn: Number(price) } : {}) }); await onSaved(); toast.success('Tier updated.'); }
    catch (error: unknown) { toast.error(getFriendlyErrorMessage(error, 'Unable to save this tier.')); }
    finally { setBusy(false); }
  }
  return <section className={panelClass}>{ConfirmDialog}<h3 className="font-bold">🧵 {tier.label ?? tier.tierKey}</h3><p className="text-sm">Up Next: 1 | Pending: Unlimited | Paid jumps: {tier.queueJumpAllowed ? 'Eligible with brand enabled' : 'Unavailable'}</p><div className="grid grid-cols-2 gap-3"><label className="text-sm">Active slots<input type="number" min="0" step="1" disabled={!canEdit || legacy} value={active} onChange={(event) => setActive(event.target.value)} className={inputClass} placeholder="Unlimited" /></label><label className="text-sm">Delivery slots<input type="number" min="0" step="1" disabled={!canEdit || legacy} value={delivery} onChange={(event) => setDelivery(event.target.value)} className={inputClass} placeholder="Unlimited" /></label></div><label className="block text-sm">Monthly price (NGN)<input type="number" min="100" step="1" disabled={!canPrice || legacy} value={price} onChange={(event) => setPrice(event.target.value)} className={inputClass} /></label>{!canPrice ? <p className="text-xs">Only a super admin can change prices.</p> : null}{legacy ? <p className="text-sm">Existing Legacy brands keep free unlimited capacity until a paid assignment succeeds.</p> : <button className="queue-button" onClick={() => void save()} disabled={!canEdit || busy || !Number.isInteger(Number(active)) || Number(active) < 0 || !Number.isInteger(Number(delivery)) || Number(delivery) < 0 || !Number.isInteger(Number(price)) || Number(price) < 100}>{busy ? 'Saving…' : 'Review and save'}</button>}</section>;
}
export default function AdminOrderQueueWorkspace() {
  const [tab, setTab] = useState('tiers');
  const { hasPermission, isSuperAdmin } = useAdminPermissions();
  const canRead = hasPermission('brands.read');
  const canEdit = hasPermission('brands.store_override');
  const tiers = useQuery({ queryKey: ['queue-admin-tiers'], queryFn: adminOrderQueueApi.tiers, enabled: canRead });
  const campaigns = useQuery({ queryKey: ['queue-admin-campaigns'], queryFn: adminOrderQueueApi.campaigns, enabled: canRead && tab === 'campaigns' });
  const notices = useQuery({ queryKey: ['queue-admin-notices'], queryFn: adminOrderQueueApi.notices, enabled: canRead && tab === 'notices' });
  const [delta, setDelta] = useState('1');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [resetMode, setResetMode] = useState('AUTOMATIC');
  const [note, setNote] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState('GENERAL');
  const [publish, setPublish] = useState(false);
  const [busy, setBusy] = useState(false);
  const { confirm, ConfirmDialog } = useQueueConfirm();
  const current = tab === 'tiers' ? tiers : tab === 'campaigns' ? campaigns : notices;
  async function run(titleText: string, message: string, work: () => Promise<unknown>) {
    if (!(await confirm({ title: titleText, message, confirmText: 'Confirm' }))) return;
    setBusy(true);
    try { await work(); await current.refetch(); toast.success('Saved.'); }
    catch (error: unknown) { toast.error(getFriendlyErrorMessage(error, 'Unable to apply this change.')); }
    finally { setBusy(false); }
  }
  const time = (value: string) => new Date(`${value}+01:00`).toISOString();
  const validDates = Boolean(start && end && Date.parse(`${end}+01:00`) > Date.parse(`${start}+01:00`));
  if (!canRead) return <p className={panelClass}>Your role cannot view subscription configuration.</p>;
  return <section className="space-y-4">{ConfirmDialog}<div className="flex flex-wrap gap-2" role="tablist" aria-label="Custom-order configuration">{[['tiers', '🧵 Subscription tiers'], ['campaigns', '📈 Capacity campaigns'], ['notices', '📣 Runway notices']].map(([value, label]) => <button key={value} role="tab" aria-selected={tab === value} className="queue-tab" onClick={() => setTab(value)}>{label}</button>)}</div>{current.isPending ? <p role="status">Loading configuration…</p> : current.isError ? <div role="alert" className={panelClass}>Unable to load configuration. <button className="queue-button" onClick={() => void current.refetch()}>Retry</button></div> : null}
    {tab === 'tiers' ? <div className="grid gap-4 md:grid-cols-2">{collection(tiers.data, 'tiers').map((tier) => <TierEditor key={`${tier.tierKey}-${tier.monthlyPriceNgn}-${tier.maxActive}-${tier.maxInDelivery}-${tier.updatedAt}`} tier={tier} canEdit={canEdit} canPrice={canEdit && isSuperAdmin} onSaved={() => tiers.refetch()} />)}</div> : null}
    {tab !== 'tiers' ? <section className={panelClass}><h3 className="font-bold">{tab === 'campaigns' ? 'New capacity campaign' : 'Create a Runway notice'}</h3>{tab === 'campaigns' ? <><p className="text-sm">Only one global campaign can be active at a time. Brand overrides win. This increases Active capacity, while preserving existing orders when it ends.</p><label className="block text-sm">Additional Active slots<input className={inputClass} type="number" min="1" step="1" value={delta} onChange={(event) => setDelta(event.target.value)} disabled={!canEdit} /></label><UniversalSelect label="Campaign end" value={resetMode} onChange={setResetMode} options={[{ value: 'AUTOMATIC', label: 'End exactly at deadline' }, { value: 'MANUAL', label: 'Continue until admin resets' }]} disabled={!canEdit} /><label className="block text-sm">Admin note<textarea className={inputClass} value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} /></label></> : <><label className="block text-sm">Notice title<input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} /></label><label className="block text-sm">Notice body<textarea className={inputClass} value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} /></label><UniversalSelect label="Notice type" value={kind} onChange={setKind} options={[{ value: 'GENERAL', label: 'General information' }, { value: 'BONUS', label: 'Capacity bonus' }, { value: 'FREE_ORDER_PERIOD', label: 'Free-order period information' }]} /><label className="flex items-center gap-2"><input type="checkbox" checked={publish} onChange={(event) => setPublish(event.target.checked)} />Publish at start time</label><p className="text-sm">Publishing a notice is informational. It does not change charges or capacity; configure any benefits separately.</p>{title || body ? <aside className="border-l-2 border-violet-400 pl-4"><strong>Preview: {title}</strong><p className="whitespace-pre-wrap break-words">{body}</p></aside> : null}</>}
      <div className="grid grid-cols-2 gap-3"><label className="text-sm">Starts (Lagos / WAT)<input className={inputClass} type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} /></label><label className="text-sm">Ends (Lagos / WAT)<input className={inputClass} type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} /></label></div>
      <button className="queue-button" disabled={!canEdit || busy || !validDates || (tab === 'notices' ? !title.trim() || !body.trim() : !Number.isInteger(Number(delta)) || Number(delta) < 1)} onClick={() => void run(tab === 'campaigns' ? 'Start capacity campaign?' : 'Save Runway notice?', tab === 'campaigns' ? `${delta} additional Active slots. ${resetMode === 'MANUAL' ? 'Capacity continues until explicitly reset, even past the displayed deadline.' : 'Capacity ends exactly at the deadline.'} Brand overrides retain priority.` : `${publish ? 'The notice will be visible during its scheduled window.' : 'This will be saved as a draft.'} No financial terms change.`, () => tab === 'campaigns' ? adminOrderQueueApi.campaign({ deltaActive: Number(delta), startsAt: time(start), endsAt: time(end), resetMode: resetMode as 'AUTOMATIC' | 'MANUAL', note: note.trim() || undefined }) : adminOrderQueueApi.notice({ title: title.trim(), body: body.trim(), startsAt: time(start), endsAt: time(end), kind: kind as 'GENERAL' | 'BONUS' | 'FREE_ORDER_PERIOD', published: publish }))}>{busy ? 'Saving…' : 'Review and save'}</button>
    </section> : null}
    {tab === 'campaigns' ? <div className="space-y-3">{collection(campaigns.data, 'campaigns').length === 0 ? <p>No capacity campaigns yet.</p> : collection(campaigns.data, 'campaigns').map((item) => <section className={panelClass} key={item.id}><h3 className="font-bold">+{item.deltaActive} Active slots ? {item.resetAt ? 'Reset' : item.resetMode === 'MANUAL' ? 'Manual: continues until reset' : 'Automatic deadline'}</h3><p className="text-sm">{new Date(item.startsAt).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })} - {new Date(item.endsAt).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })} WAT</p>{item.note ? <p className="break-words">{item.note}</p> : null}{!item.resetAt && canEdit ? <button className="queue-button" disabled={busy} onClick={() => void run('Reset campaign?', 'Existing orders are preserved. New admissions use the restored capacity; brand overrides still win.', () => adminOrderQueueApi.resetCampaign(item.id))}>Review reset</button> : null}</section>)}</div> : null}
    {tab === 'notices' ? <div className="space-y-3">{collection(notices.data, 'notices').length === 0 ? <p>No Runway notices yet.</p> : collection(notices.data, 'notices').map((item) => <section className={panelClass} key={item.id}><h3 className="font-bold">📣 {item.title}</h3><p className="whitespace-pre-wrap break-words">{item.body}</p><p className="text-xs">{item.endedAt ? 'Ended' : item.published ? 'Published / scheduled' : 'Draft'} | {item.kind}</p>{!item.endedAt && !item.published && canEdit ? <button className="queue-button" disabled={busy} onClick={() => void run('Publish saved draft?', 'This notice becomes visible during its scheduled start and end window. It does not change prices or capacity.', () => adminOrderQueueApi.publishNotice(item.id, true))}>Publish draft</button> : null}{!item.endedAt && canEdit ? <button className="queue-button" disabled={busy} onClick={() => void run('End this notice?', 'The notice will stop appearing on Runway. Capacity and charges retain their configured rules.', () => adminOrderQueueApi.endNotice(item.id))}>End notice</button> : null}</section>)}</div> : null}
  </section>;
}
