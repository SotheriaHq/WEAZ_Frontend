import { browserSupportsWebAuthn, startAuthentication, startRegistration, WebAuthnAbortService,
  type AuthenticationResponseJSON, type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON, type RegistrationResponseJSON } from '@simplewebauthn/browser';
import { SecurityVerificationCancelled, SecurityVerificationError } from './securityChallenge';

export type PasskeyAvailability = { available: boolean; message: string | null };
export async function passkeyAvailability(configuration: { webConfigured: boolean; androidConfigured: boolean }): Promise<PasskeyAvailability> {
  const available = configuration.webConfigured && typeof window !== 'undefined' && browserSupportsWebAuthn();
  return { available, message: available ? null : 'Passkeys cannot be used in this view. Use an authenticator app or an unused recovery code.' };
}
function failure(error: unknown) {
  const name = (error as { name?: string; code?: string })?.name;
  return new SecurityVerificationError(name === 'NotAllowedError' || name === 'AbortError'
    ? 'The passkey prompt was cancelled or timed out. You can try again or choose another method.'
    : 'The passkey could not be completed. Try again or choose an authenticator or recovery code.');
}
let active: symbol | null = null;
async function ceremony<T>(work: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) throw new SecurityVerificationCancelled();
  if (active) throw new SecurityVerificationError('Finish or cancel the current passkey prompt, then try again.');
  const owner = Symbol(); active = owner;
  const abort = () => { if (active === owner) WebAuthnAbortService.cancelCeremony(); };
  signal?.addEventListener('abort', abort, { once: true });
  try { const result = await work(); if (signal?.aborted) throw new SecurityVerificationCancelled(); return result; }
  catch (error) { if (error instanceof SecurityVerificationCancelled) throw error; throw failure(error); }
  finally { signal?.removeEventListener('abort', abort); if (active === owner) active = null; }
}
// Options are fetched before rendering the action. Call these directly from the user's press.
export function createPasskey(options: PublicKeyCredentialCreationOptionsJSON, signal?: AbortSignal): Promise<RegistrationResponseJSON> {
  return ceremony(() => startRegistration({ optionsJSON: options }), signal);
}
export function authenticatePasskey(options: PublicKeyCredentialRequestOptionsJSON, signal?: AbortSignal): Promise<AuthenticationResponseJSON> {
  return ceremony(() => startAuthentication({ optionsJSON: options }), signal);
}
