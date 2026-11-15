import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { getStoredAccessToken } from '@/api/httpClient';
import { securityIdentityFromToken } from '@/auth/securityChallenge';
import { useMfaRecovery, mfaRecoveryLabels, mfaRecoveryApprovalSummary } from '@/auth/useMfaRecovery';
import { MfaSetupModal } from '@/components/settings/MfaSettingsPanel';
import { SettingsSectionHeading } from '@/components/settings/SettingsSectionHeading';
import TextField from '@/components/forms/TextField';
import TextAreaField from '@/components/forms/TextAreaField';
import Button from '@/components/ui/Button';

const identity = () => securityIdentityFromToken(getStoredAccessToken(), value => atob(value));
function RecoveryContent() {
  const initial = useRef(identity());
  const current = () => Boolean(initial.current) && identity() === initial.current;
  const flow = useMfaRecovery(current);
  const [setup, setSetup] = useState(false);
  const setupOpen = useRef(setup); setupOpen.current = setup;
  const close = () => { setupOpen.current = false; setSetup(false); void flow.reload(); };
  return <div className="space-y-5 break-words">
    <p>If you lost every authenticator, passkey and saved recovery code, start account recovery. Production recovery requires two independent authorised administrators. The requirements for this account appear with your request.</p>
    <p>Submitting a request does not disable protection. Email access alone is not sufficient. If support cannot establish ownership, recovery will not be approved.</p>
    <p>Do not include passwords, authenticator setup keys, payment-card details or recovery codes in this request.</p>
    {!flow.loaded && !flow.error ? <p role="status">Loading recovery status…</p> : null}
    {flow.request ? <>
      <SettingsSectionHeading>{flow.canContinueWithoutReview ? 'Continue account recovery' : mfaRecoveryLabels[flow.request.status]}</SettingsSectionHeading>
      <p>Reference: <span className="break-all">{flow.request.id}</span></p>
      <p>{mfaRecoveryApprovalSummary(flow.request)}</p>
      <p>Request expiry: {new Date(flow.request.expiresAt).toLocaleString()}</p>
      {flow.request.message ? <p>{flow.request.message}</p> : null}
      {flow.request.reviewChanged ? <p role="alert">An approval is no longer valid. Cancel this request and ask for a new review.</p> : null}
      {flow.canEnroll ? <>
        <p>Approval expires: {flow.request.approvedUntil ? new Date(flow.request.approvedUntil).toLocaleString() : 'Check status again'}.</p>
        <p>Your old methods stay active until the replacement works. Completing recovery retires old methods, old recovery codes and other signed-in sessions.</p>
        <Button disabled={flow.busy} onClick={() => setSetup(true)}>Set up replacement authenticator</Button>
      </> : null}
      {flow.request.status === 'PENDING_REVIEW' && !flow.canContinueWithoutReview ? <p>No automatic approval is available. Check back after the support review.</p> : null}
      {flow.request.status === 'COMPLETED' ? <p>Your replacement method is active. Use your newly saved recovery codes going forward.</p> : null}
      {['CANCELLED', 'EXPIRED', 'REJECTED'].includes(flow.request.status) ? <p>This request has ended. You may submit a new request with relevant information; request limits still apply.</p> : null}
    </> : null}
    {flow.loaded && (flow.canSubmit || flow.active) ? <TextField label="Current password" aria-label="Current password" type="password" autoComplete="current-password" value={flow.password} maxLength={1024} onChange={event => flow.setPassword(event.target.value)} /> : null}
    {flow.canContinueWithoutReview ? <Button loading={flow.busy} disabled={flow.busy} onClick={() => void flow.continueRecovery()}>Continue recovery</Button> : null}
    {flow.canSubmit ? <>
      <TextAreaField label={flow.request?.status === 'NEEDS_INFORMATION' ? 'Additional information for support' : 'What happened?'} aria-label="Recovery information" inputClassName="border-2" maxLength={1000} rows={4} value={flow.reason} onChange={event => flow.setReason(event.target.value)} />
      <Button loading={flow.busy} disabled={flow.busy} onClick={() => void flow.submit()}>{flow.request?.status === 'NEEDS_INFORMATION' ? 'Send information for a new review' : 'Request support review'}</Button>
    </> : null}
    <div className="flex flex-wrap gap-3">
      <Button variant="secondary" disabled={flow.busy} onClick={() => void flow.reload()}>Refresh recovery status</Button>
      {flow.active ? <Button variant="secondary" disabled={flow.busy} onClick={() => void flow.cancel()}>Cancel recovery request</Button> : null}
    </div>
    {flow.error ? <p role="alert" className="text-rose-600 dark:text-rose-300">{flow.error}</p> : null}
    {setup && flow.request ? <MfaSetupModal mode={{ kind: 'recover', requestId: flow.request.id }} isCurrent={() => setupOpen.current && current()} onClose={close} /> : null}
  </div>;
}
export default function MfaRecoveryPage() {
  const actorId = useSelector((state: RootState) => state.user.profile?.id);
  return <main className="wiez-settings-screen mx-auto max-w-2xl space-y-6 px-5 py-8">
    <Link className="inline-block py-3 underline" to="/settings">Back to Settings</Link>
    <h1 className="text-2xl font-semibold">Verification recovery</h1>
    {actorId ? <RecoveryContent key={actorId} /> : <Link to="/login">Sign in to review account recovery</Link>}
  </main>;
}
