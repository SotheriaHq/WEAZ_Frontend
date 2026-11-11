import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { SecurityMfaApi, mfaErrorMessage, type AdminMfaRecoveryRequest, type MfaRecoveryReviewInput } from '@/api/SecurityMfaApi';
import { mfaRecoveryLabels } from '@/auth/useMfaRecovery';
import Button from '@/components/ui/Button';
import TextField from '@/components/forms/TextField';
import TextAreaField from '@/components/forms/TextAreaField';

function ReviewRequest({ request, actorId, onDone }: { request: AdminMfaRecoveryRequest; actorId: string; onDone: () => void }) {
  const [decision, setDecision] = useState<MfaRecoveryReviewInput['decision']>('REQUEST_INFORMATION');
  const [reference, setReference] = useState(''), [message, setMessage] = useState('');
  const [attested, setAttested] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const alive = useRef(true), locked = useRef(false), pending = useRef<AbortController | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; pending.current?.abort(); }; }, []);
  const reviewed = request.reviews.some(review => review.reviewerId === actorId && review.revision === request.revision);
  const canReview = request.status === 'PENDING_REVIEW' && !reviewed && request.userId !== actorId;
  const submit = async () => {
    if (!canReview || locked.current) return;
    if (!reference.trim() || (decision !== 'APPROVE' && !message.trim()) || (decision === 'APPROVE' && !attested)) {
      setError('Record an evidence reference, provide any requested explanation, and confirm independent ownership verification before approval.'); return;
    }
    locked.current = true; setBusy(true); setError(''); pending.current = new AbortController();
    try {
      await SecurityMfaApi.reviewRecovery(request.id, { revision: request.revision, decision, evidenceReference: reference.trim(),
        ...(decision === 'APPROVE' ? { identityVerified: true } : { message: message.trim() }) }, pending.current.signal);
      if (alive.current) onDone();
    } catch (failure) { if (alive.current && !pending.current.signal.aborted) setError(mfaErrorMessage(failure)); }
    finally { locked.current = false; if (alive.current) setBusy(false); }
  };
  return <section className="space-y-4 py-6 break-words">
    <h2 className="text-lg font-semibold">{request.user.username} · {mfaRecoveryLabels[request.status]}</h2>
    <p className="break-all">Reference: {request.id} · Revision {request.revision}</p>
    <p>{request.reason}</p><p>Expires: {new Date(request.expiresAt).toLocaleString()}</p>
    <p>{request.reviews.filter(review => review.revision === request.revision && review.decision === 'APPROVE').length} of 2 approvals.</p>
    {request.userId === actorId ? <p>You cannot review your own recovery request.</p> : null}
    {reviewed ? <p>You already reviewed this revision. A different authorised administrator must provide the other approval.</p> : null}
    {canReview ? <>
      <div className="flex flex-wrap gap-3" role="group" aria-label="Review decision">
        {(['REQUEST_INFORMATION', 'REJECT', 'APPROVE'] as const).map(value => <Button key={value} variant={decision === value ? 'brand' : 'secondary'} disabled={busy} onClick={() => { setDecision(value); setAttested(false); }}>
          {value === 'REQUEST_INFORMATION' ? 'Request information' : value === 'REJECT' ? 'Reject request' : 'Approve this review'}
        </Button>)}
      </div>
      <TextField label="Private evidence reference" aria-label="Private evidence reference" value={reference} maxLength={200} onChange={event => setReference(event.target.value)} helperText="Use a restricted support-case reference. Do not paste documents, credentials or authenticator codes." />
      {decision === 'APPROVE' ? <>
        <p>Use evidence independent of the current login/email. If ownership cannot be established, reject the request. Do not approve based on urgency, public profile details or email access alone.</p>
        <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={attested} onChange={event => setAttested(event.target.checked)} /><span>I independently verified the account holder and recorded the evidence in the referenced restricted case.</span></label>
      </> : <TextAreaField label="Message visible to the account holder" aria-label="Message visible to the account holder" rows={4} inputClassName="border-2" maxLength={1000} value={message} onChange={event => setMessage(event.target.value)} />}
      <Button loading={busy} disabled={busy} onClick={() => void submit()}>Verify identity and submit this decision</Button>
      {error ? <p role="alert" className="text-rose-600 dark:text-rose-300">{error}</p> : null}
    </> : null}
  </section>;
}
export default function AdminMfaRecoveryPage() {
  const actorId = useSelector((state: RootState) => state.user.profile?.id ?? '');
  const [page, setPage] = useState<{ items: AdminMfaRecoveryRequest[]; nextCursor: string | null } | null>(null);
  const [cursor, setCursor] = useState<string | undefined>(), [version, setVersion] = useState(0), [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setError(''); setPage(null);
    SecurityMfaApi.adminRecoveryQueue(cursor, controller.signal).then(result => { if (!controller.signal.aborted) setPage(result); })
      .catch(failure => { if (!controller.signal.aborted) setError(mfaErrorMessage(failure)); });
    return () => controller.abort();
  }, [cursor, version, actorId]);
  return <main className="space-y-5 break-words">
    <h1 className="text-2xl font-semibold">Verification recovery reviews</h1>
    <p>Two independent approvals are required. Existing methods stay active until a verified replacement is confirmed.</p>
    <p>Never ask for passwords, setup keys or recovery codes. Reject requests when ownership cannot be established.</p>
    {!page && !error ? <p role="status">Loading recovery requests…</p> : null}
    {error ? <p role="alert">{error}</p> : null}
    {page?.items.length === 0 ? <p>No open recovery requests.</p> : null}
    {page?.items.map(request => <ReviewRequest key={`${request.id}:${request.revision}:${request.status}`} request={request} actorId={actorId} onDone={() => setVersion(value => value + 1)} />)}
    <div className="flex flex-wrap gap-3">
      <Button variant="secondary" onClick={() => setVersion(value => value + 1)}>Refresh requests</Button>
      {page?.nextCursor ? <Button variant="secondary" onClick={() => setCursor(page.nextCursor!)}>More requests</Button> : null}
      {cursor ? <Button variant="secondary" onClick={() => setCursor(undefined)}>Oldest open requests</Button> : null}
    </div>
  </main>;
}
