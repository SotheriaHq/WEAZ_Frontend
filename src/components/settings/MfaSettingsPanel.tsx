import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { SecurityMfaApi, mfaErrorMessage, type MfaStatus } from '@/api/SecurityMfaApi';
import { getStoredAccessToken } from '@/api/httpClient';
import { securityChallenges, securityIdentityFromToken, type SecurityPrompt } from '@/auth/securityChallenge';
import { useMfaJourney, type MfaJourneyMode } from '@/auth/useMfaJourney';
import { useMfaVerification } from '@/auth/useMfaVerification';
import { usePasskeySupport } from '@/auth/usePasskeySupport';
import { useOverlayBackClose } from '@/hooks/useOverlayBackClose';
import Button from '@/components/ui/Button';
import TextField from '@/components/forms/TextField';
import Modal from '@/components/ui/Modal';
import { SettingsSectionHeading } from './SettingsSectionHeading';
import { requestPhoneSessionVerification } from '@/auth/parentSessionBridge';

const identity = () => securityIdentityFromToken(getStoredAccessToken(), value => atob(value));

function MfaSetupContent({ mode, flow, onDone, onMethodChange }: {
  mode: MfaJourneyMode; flow: ReturnType<typeof useMfaJourney>; onDone: () => void;
  onMethodChange?: (kind: 'add' | 'passkey') => void;
}) {
  const [copyError, setCopyError] = useState('');
  const blocked = flow.step === 'password' && (!flow.status?.setup?.hasPassword || !flow.status?.setup?.emailVerified);
  return <div className="space-y-4 break-words" aria-busy={flow.busy}>
    <p>MFA means multi-factor authentication: an extra proof of identity beyond your password.</p>
    {flow.step === 'loading' ? <><p role="status">Loading your verification methods…</p>{flow.error && <Button onClick={() => void flow.reload()}>Retry loading</Button>}</> : null}
    {flow.step === 'password' ? <>
      {onMethodChange ? <div role="group" aria-label="Set up verification" className="flex flex-wrap gap-3">
        <Button variant={mode.kind === 'add' ? 'brand' : 'secondary'} disabled={flow.busy} onClick={() => onMethodChange('add')}>Authenticator app</Button>
        <Button variant={mode.kind === 'passkey' ? 'brand' : 'secondary'} disabled={flow.busy || !flow.passkeySupport.available} onClick={() => onMethodChange('passkey')}>Passkey</Button>
      </div> : null}
      {mode.kind === 'passkey' || onMethodChange ? <p role="status">{flow.passkeySupport.checking ? 'Checking passkey support…' : flow.passkeySupport.message}</p> : null}
      {mode.kind === 'passkey' ? <>
        <p>Your device or password manager will ask you to create a passkey. WIEZ never receives your fingerprint, face or device PIN.</p>
        <TextField id="mfa-passkey-label" name="passkey-label" label="Passkey name" aria-label="Passkey name" autoComplete="off" value={flow.passkeyLabel} maxLength={80} onChange={event => flow.setPasskeyLabel(event.target.value)} />
      </> : null}
      {mode.kind === 'replace' ? <p>Your current authenticator stays active until the replacement is confirmed.</p> : null}
      {mode.kind === 'remove' ? <p>Remove this selected method? You must keep at least one verified method. You will verify this exact change before it is applied.</p> : null}
      {mode.kind === 'regenerate' ? <p>All previous recovery codes will stop working. You will verify this exact change before new codes are created.</p> : null}
      {!flow.status?.setup?.hasPassword ? <p>Set a password before managing verification. <Link to="/forgot-password" className="underline">Set or reset your password</Link></p> : null}
      {!flow.status?.setup?.emailVerified ? <>
        <p>Verify your account email before starting setup.</p>
        <Button variant="secondary" disabled={flow.busy} onClick={() => void flow.requestAccountVerification()}>Send verification link</Button>
        {flow.verificationEmailSent ? <p role="status">Check your inbox and open the verification link. Then return here and check again.</p> : null}
        <Button variant="secondary" disabled={flow.busy} onClick={() => void flow.reload()}>I verified my email — check again</Button>
      </> : null}
      {!blocked ? <TextField id="mfa-current-password" label="Current password" aria-label="Current password" autoComplete="current-password" type="password" value={flow.password} maxLength={1024} onChange={event => flow.setPassword(event.target.value)} /> : null}
    </> : null}
    {flow.step === 'email' ? <>
      <p>Enter the eight-digit code sent to your verified account email. Delivery can take a moment.</p>
      <TextField id="mfa-email-code" label="Email code" aria-label="Email code" inputMode="numeric" autoComplete="one-time-code" value={flow.code} maxLength={8} onChange={event => flow.setCode(event.target.value.replace(/\D/g, ''))} />
      <Button variant="secondary" disabled={flow.busy || flow.expired} onClick={() => void flow.resend()}>Request another email code</Button>
    </> : null}
    {flow.step === 'authenticator' && flow.setup ? <>
      <p>Scan this QR code in an authenticator app, or enter the setup key manually. Keep this key private.</p>
      <div className="w-fit bg-white p-3"><QRCodeSVG value={flow.setup.uri} size={180} title="Authenticator setup QR code" /></div>
      <p className="select-text break-all font-mono" aria-label="Authenticator setup key">{flow.setup.secret}</p>
      <TextField id="mfa-totp-code" label="Authenticator code" aria-label="Authenticator code" inputMode="numeric" autoComplete="one-time-code" value={flow.code} maxLength={6} onChange={event => flow.setCode(event.target.value.replace(/\D/g, ''))} />
    </> : null}
    {flow.step === 'passkey' ? <>
      <p>{flow.passkeyResponse ? 'Your passkey was created on your device. Confirm it with WIEZ to finish setup. If the connection failed, retry confirmation without creating another passkey.' : 'Ready to create your passkey. Press Create passkey to open the secure system prompt. Cancelling keeps your existing methods unchanged.'}</p>
      {flow.busy ? <p role="status">{flow.passkeyResponse ? 'Confirming your passkey with WIEZ…' : 'Complete or cancel the passkey prompt on your device…'}</p> : null}
    </> : null}
    {flow.remainingSeconds !== null ? <p role="status">{flow.expired ? 'This setup has expired. Close it and start again.' : `Setup expires in ${flow.remainingSeconds} seconds.`}</p> : null}
    {flow.step === 'codes' ? <>
      <p>Save these codes somewhere private before continuing. Each works once. WIEZ cannot show them again.</p>
      <div className="select-text space-y-2 font-mono">{flow.codes.map(code => <p className="break-all" key={code}>{code}</p>)}</div>
      <Button variant="secondary" onClick={async () => {
        try { await navigator.clipboard.writeText(flow.codes.join('\n')); setCopyError(''); }
        catch { setCopyError('Copy is unavailable. Select and save the codes manually.'); }
      }}>Copy recovery codes</Button>
      {copyError ? <p role="alert">{copyError}</p> : null}
      <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={flow.saved} onChange={event => flow.setSaved(event.target.checked)} /><span>I saved my recovery codes somewhere private.</span></label>
    </> : null}
    {flow.step === 'complete' ? <p role="status">{mode.kind === 'recover' ? 'Recovery completed. Earlier methods, recovery codes and other sessions were retired.' : 'Your verification methods are updated. Existing recovery codes remain valid unless you replaced them.'}</p> : null}
    {flow.error ? <p role="alert" className="text-rose-600 dark:text-rose-300">{flow.error}</p> : null}
    {flow.step === 'codes' || flow.step === 'complete' ? <Button disabled={flow.step === 'codes' && !flow.saved} onClick={onDone}>Done</Button> :
      flow.step !== 'loading' && !blocked ? <Button loading={flow.busy} disabled={flow.busy || flow.expired || (mode.kind === 'passkey' && !flow.passkeySupport.available)} onClick={() => void flow.submit()}>{flow.step === 'password' ? 'Continue securely' : flow.step === 'passkey' ? flow.passkeyResponse ? 'Retry passkey confirmation' : 'Create passkey' : 'Confirm code'}</Button> : null}
  </div>;
}

/** One reusable close boundary for normal setup, first enrollment and reviewed recovery. */
export function MfaSetupModal({ mode, isCurrent, onClose, onDone, onMethodChange }: {
  mode: MfaJourneyMode; isCurrent: () => boolean; onClose: () => void;
  onDone?: () => void;
  onMethodChange?: (kind: 'add' | 'passkey') => void;
}) {
  const flow = useMfaJourney(mode, isCurrent);
  const unsaved = flow.step === 'codes' && !flow.saved;
  const [warning, setWarning] = useState(false);
  const close = () => { if (unsaved) setWarning(true); else onClose(); };
  useEffect(() => {
    if (!unsaved) return;
    const leave = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', leave);
    return () => window.removeEventListener('beforeunload', leave);
  }, [unsaved]);
  useOverlayBackClose(true, close);
  return <Modal open onClose={close} title="Manage verification" size="sm">
    <MfaSetupContent mode={mode} flow={flow} onDone={onDone ?? onClose} onMethodChange={onMethodChange} />
    {warning ? <div role="alert" className="mt-4 space-y-3">
      <p>Save your recovery codes before closing. WIEZ cannot show them again. If you leave without saving, you can replace them later in security settings.</p>
      <div className="flex flex-wrap gap-3"><Button variant="secondary" onClick={() => setWarning(false)}>Keep codes open</Button><Button variant="danger" onClick={onClose}>Close without saving</Button></div>
    </div> : null}
    <Button className="mt-4" variant="secondary" onClick={close}>Close</Button>
  </Modal>;
}

function MfaVerifyContent({ prompt }: { prompt: SecurityPrompt }) {
  const navigate = useNavigate();
  const flow = useMfaVerification(prompt);
  const review = prompt.challenge.review;
  return <div className="space-y-4 break-words" aria-busy={flow.busy}>
    <p>{review.title}</p>
    {review.plan ? <p>Plan: {review.plan.replaceAll('_', ' ')}</p> : null}
    {review.amountNgn ? <p>Approved amount: NGN {review.amountNgn}{review.paymentTiming === 'renewal' ? ' at renewal' : ' now'}</p> : null}
    {review.monthlyPriceNgn ? <p>Monthly price: NGN {review.monthlyPriceNgn}</p> : null}
    {review.accountEnding ? <p>Bank account ending {review.accountEnding}</p> : null}
    <p>{prompt.challenge.sensitivity === 'CRITICAL_CHANGE' ? 'This verification approves only this exact action once.' : 'Verification allows sensitive viewing for five minutes.'}</p>
    {!flow.status ? <><p role="status">Loading your methods…</p>{flow.error ? <Button onClick={() => void flow.reload()}>Retry loading</Button> : null}</> : <>
      <div className="flex flex-wrap gap-3" role="group" aria-label="Verification method">
        {flow.status.factors.some(factor => factor.kind === 'TOTP') ? <Button variant={flow.method === 'totp' ? 'brand' : 'secondary'} disabled={flow.busy} onClick={() => flow.setMethod('totp')}>Authenticator app</Button> : null}
        {flow.status.recoveryCodesRemaining > 0 ? <Button variant={flow.method === 'recovery' ? 'brand' : 'secondary'} disabled={flow.busy} onClick={() => flow.setMethod('recovery')}>Recovery code</Button> : null}
        {flow.status.factors.some(factor => factor.kind === 'PASSKEY') ? <Button variant={flow.method === 'passkey' ? 'brand' : 'secondary'} disabled={flow.busy || !flow.passkeySupport.available} onClick={() => void flow.preparePasskey()}>Prepare passkey</Button> : null}
      </div>
      {flow.status.factors.some(factor => factor.kind === 'PASSKEY') ? <p role="status">{flow.passkeySupport.checking ? 'Checking passkey support…' : flow.passkeySupport.message}</p> : null}
      {flow.method === 'passkey' ? <p>{flow.passkeyOptions ? 'Press Use passkey to open the secure system prompt. You can cancel and choose another method.' : 'Prepare your passkey above, or choose another available method.'}</p> :
        <TextField id="mfa-verification-code" label={flow.method === 'totp' ? 'Authenticator code' : 'Unused recovery code'} aria-label={flow.method === 'totp' ? 'Authenticator code' : 'Unused recovery code'} autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false} value={flow.code} maxLength={flow.method === 'totp' ? 6 : 64} onChange={event => flow.setCode(event.target.value)} />}
      <Button loading={flow.busy} disabled={flow.busy || (flow.method === 'passkey' ? !flow.passkeyOptions || !flow.passkeySupport.available : !flow.code)} onClick={() => void flow.submit()}>{flow.method === 'passkey' ? 'Use passkey' : 'Verify and continue'}</Button>
      <p>Lost every method and recovery code? Account recovery requires support review. Email access alone cannot remove verification.</p>
      <Button variant="secondary" onClick={() => { prompt.cancel(); navigate('/settings/mfa-recovery'); }}>Review account recovery</Button>
    </>}
    {flow.error ? <p role="alert" className="text-rose-600 dark:text-rose-300">{flow.error}</p> : null}
  </div>;
}

export function MfaVerificationDialog() {
  const location = useLocation();
  const route = `${location.pathname}${location.search}`;
  const previousRoute = useRef(route);
  useEffect(() => { if (previousRoute.current !== route) { previousRoute.current = route; securityChallenges.cancel(); } }, [route]);
  const [prompt, setPrompt] = useState<SecurityPrompt | null>(null);
  useEffect(() => securityChallenges.register(value => { setPrompt(value); return () => setPrompt(null); }), []);
  const close = () => prompt?.cancel();
  useOverlayBackClose(Boolean(prompt) && prompt?.challenge.code !== 'MFA_ENROLLMENT_REQUIRED', close);
  if (prompt?.challenge.code === 'MFA_ENROLLMENT_REQUIRED') return <MfaEnrollmentContent key={prompt.identity} prompt={prompt} />;
  return <Modal open={Boolean(prompt)} onClose={close} title="Verify your identity" size="sm">
    {prompt ? <div key={`${prompt.identity}:${prompt.challenge.challengeId ?? 'enrollment'}`}>
      {prompt.challenge.code === 'PARENT_SESSION_VERIFICATION_REQUIRED' ? <PhoneSessionVerification prompt={prompt} /> : <MfaVerifyContent prompt={prompt} />}
      <Button className="mt-4" variant="secondary" onClick={close}>Cancel verification</Button>
    </div> : null}
  </Modal>;
}

function PhoneSessionVerification({ prompt }: { prompt: SecurityPrompt }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const verify = async () => {
    if (pending.current || !prompt.isCurrent()) return;
    const controller = new AbortController(); pending.current = controller; setBusy(true); setError('');
    try {
      await requestPhoneSessionVerification(prompt.challenge.parentSessionId!, controller.signal);
      if (!controller.signal.aborted && prompt.isCurrent()) prompt.complete({ actionProof: null });
    } catch (failure) {
      if (!controller.signal.aborted && prompt.isCurrent()) setError(failure instanceof Error ? failure.message : 'Phone verification did not finish.');
    } finally {
      if (pending.current === controller) { pending.current = null; if (!controller.signal.aborted) setBusy(false); }
    }
  };
  return <div className="space-y-4 break-words">
    <p>WIEZ flagged the phone session that opened Studio. Verify that phone session first, then resume here. Verifying this Studio session cannot unlock your phone.</p>
    <Button loading={busy} disabled={busy} onClick={() => void verify()}>Verify on this phone</Button>
    <Button variant="secondary" disabled={busy} onClick={() => prompt.complete({ actionProof: null })}>I verified the phone; retry Studio</Button>
    {error ? <p role="alert">{error}</p> : null}
  </div>;
}

function MfaEnrollmentContent({ prompt }: { prompt: SecurityPrompt }) {
  const [kind, setKind] = useState<'add' | 'passkey'>('add');
  const chosen = useRef(kind); chosen.current = kind;
  return <MfaSetupModal key={kind} mode={{ kind }} isCurrent={() => chosen.current === kind && prompt.isCurrent()}
    onMethodChange={setKind} onClose={prompt.cancel} onDone={() => prompt.complete({ actionProof: null, enrolled: true })} />;
}

export function MfaSettingsPanel({ actorId }: { actorId: string }) {
  const [status, setStatus] = useState<MfaStatus | null>(null), [error, setError] = useState('');
  const [version, setVersion] = useState(0), [mode, setMode] = useState<MfaJourneyMode | null>(null);
  const initialIdentity = useRef(identity());
  const chosenMode = useRef(mode); chosenMode.current = mode;
  const passkeySupport = usePasskeySupport(status?.passkeys);
  const current = () => Boolean(initialIdentity.current) && identity() === initialIdentity.current;
  useEffect(() => securityChallenges.onCancel(() => { setMode(null); setStatus(null); setVersion(value => value + 1); }), []);
  useEffect(() => {
    const controller = new AbortController(); setError('');
    initialIdentity.current = identity();
    if (!initialIdentity.current?.startsWith(`${actorId}:`)) {
      setError('Sign in again to manage verification for this account.'); return () => controller.abort();
    }
    SecurityMfaApi.status(controller.signal).then(result => { if (!controller.signal.aborted && current()) setStatus(result); })
      .catch(failure => { if (!controller.signal.aborted) setError(mfaErrorMessage(failure)); });
    return () => controller.abort();
  }, [actorId, version]);
  const close = () => { chosenMode.current = null; setMode(null); setVersion(value => value + 1); };
  return <section className="space-y-4 py-6" data-settings-section>
    <SettingsSectionHeading>Multi-factor authentication (MFA)</SettingsSectionHeading>
    <p>Add an extra proof of identity to protect financial and security actions.</p>
    {!status && !error ? <p role="status">Loading verification methods…</p> : null}
    {error ? <><p role="alert">{error}</p><Button onClick={() => setVersion(value => value + 1)}>Retry methods</Button></> : null}
    {status ? <>
      {!status.factors.length ? <p>No verification methods are set up yet.</p> : <>
        <p>{status.recoveryCodesRemaining} unused recovery codes. Keep at least one verified method.</p>
        {status.factors.map(factor => <div key={factor.id} className="space-y-2 py-3">
          <h3 className="font-medium break-words">{factor.label}</h3><p>{factor.kind === 'TOTP' ? 'Authenticator app' : 'Passkey'} · Verified</p>
          <div className="flex flex-wrap gap-3">
            {factor.kind === 'TOTP' ? <Button variant="secondary" onClick={() => setMode({ kind: 'replace', factorId: factor.id })}>Replace authenticator</Button> : null}
            <Button variant="secondary" disabled={status.factors.length < 2} onClick={() => setMode({ kind: 'remove', factorId: factor.id })}>Remove method</Button>
          </div>
        </div>)}
        {status.factors.length === 1 ? <p>Add and verify a replacement before removing your last method.</p> : null}
        <Button variant="secondary" onClick={() => setMode({ kind: 'regenerate' })}>Replace recovery codes</Button>
      </>}
      {!status.factors.some(factor => factor.kind === 'TOTP') ? <Button disabled={status.factors.length >= 10} onClick={() => setMode({ kind: 'add' })}>Set up authenticator</Button> : null}
      <Button disabled={status.factors.length >= 10 || !passkeySupport.available} onClick={() => setMode({ kind: 'passkey' })}>Add passkey</Button>
      {passkeySupport.checking ? <p role="status">Checking passkey support…</p> : passkeySupport.message ? <p>{passkeySupport.message}</p> : null}
      {status.factors.length >= 10 ? <p>You have 10 verified methods. Remove an unused method before adding another.</p> : null}
      <Button variant="secondary" onClick={() => setVersion(value => value + 1)}>Refresh verification methods</Button>
    </> : null}
    <Link to="/settings/mfa-recovery" className="inline-block py-3 underline">Lost your verification methods? Review account recovery</Link>
    {mode ? <MfaSetupModal mode={mode} isCurrent={() => chosenMode.current === mode && current()} onClose={close} /> : null}
  </section>;
}
