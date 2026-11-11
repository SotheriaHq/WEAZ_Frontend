import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { apiClient, dropStoredAccessToken, persistAccessToken } from '../api/httpClient';
import { securityChallenges, type SecurityPrompt } from './securityChallenge';

const id = '11111111-1111-4111-8111-111111111111';
const sid = '22222222-2222-4222-8222-222222222222';
const proof = `${id}.${'A'.repeat(43)}`;
const token = (sub = id) => `e30.${btoa(JSON.stringify({ sub, sid, authVersion: 1, role: 'BRAND' })).replace(/=/g, '')}.sig`;
const savedAdapter = apiClient.defaults.adapter;
let unregister: (() => void) | undefined;
function challenge(config: InternalAxiosRequestConfig, enrollment = false) {
  return new AxiosError('Verification required', 'ERR_BAD_RESPONSE', config, undefined, {
    config, status: 428, statusText: 'Precondition Required', headers: {},
    data: { code: enrollment ? 'MFA_ENROLLMENT_REQUIRED' : 'STEP_UP_REQUIRED', sensitivity: 'CRITICAL_CHANGE',
      challengeId: id, serverNow: '2026-11-02T00:00:00Z', expiresAt: '2026-11-02T00:05:00Z' },
  });
}
beforeEach(() => persistAccessToken(token()));
afterEach(() => { unregister?.(); unregister = undefined; apiClient.defaults.adapter = savedAdapter;
  dropStoredAccessToken(); vi.restoreAllMocks(); });

describe('real HTTP interceptor verification retry', () => {
  it('preserves an explicit transaction restart error without prompting or replaying the write', async () => {
    const send = vi.fn(async (config: InternalAxiosRequestConfig) => {
      throw new AxiosError('Review and retry', 'ERR_BAD_RESPONSE', config, undefined, { config,
        status: 409, statusText: 'Conflict', headers: {}, data: {
          code: 'SECURITY_VERIFICATION_RESTART_REQUIRED', message: 'Review the current state, then retry this action.' } });
    });
    apiClient.defaults.adapter = send;
    const present = vi.fn(); unregister = securityChallenges.register(present);
    await expect(apiClient.post('/verification/physical/fixture/decision', { outcome: 'PASSED' }))
      .rejects.toMatchObject({ response: { status: 409, data: { code: 'SECURITY_VERIFICATION_RESTART_REQUIRED' } } });
    expect(send).toHaveBeenCalledOnce(); expect(present).not.toHaveBeenCalled();
  });
  it('verifies the parent first, then requests a separate exact approval without changing the operation', async () => {
    const calls: InternalAxiosRequestConfig[] = [];
    apiClient.defaults.adapter = async config => {
      calls.push(config);
      if (calls.length === 1) throw new AxiosError('Phone required', 'ERR_BAD_RESPONSE', config, undefined, {
        config, status: 428, statusText: 'Precondition Required', headers: {}, data: {
          code: 'PARENT_SESSION_VERIFICATION_REQUIRED', parentSessionId: id, sensitivity: 'SENSITIVE_READ',
          serverNow: '2026-11-02T00:00:00Z', expiresAt: '2026-11-02T00:05:00Z' } });
      if (calls.length === 2) throw challenge(config);
      return { config, status: 200, statusText: 'OK', headers: {}, data: {} };
    };
    const prompts: string[] = [];
    unregister = securityChallenges.register(prompt => {
      prompts.push(prompt.challenge.code);
      prompt.complete({ actionProof: prompt.challenge.code === 'STEP_UP_REQUIRED' ? proof : null });
    });
    await apiClient.post('/sensitive/parent-check', { quoteId: 'unchanged' }, { headers: { 'Idempotency-Key': 'same-key' } });
    expect(prompts).toEqual(['PARENT_SESSION_VERIFICATION_REQUIRED', 'STEP_UP_REQUIRED']);
    expect(calls).toHaveLength(3); expect(new Set(calls.map(call => call.data)).size).toBe(1);
    expect(calls[2].headers.get('Idempotency-Key')).toBe('same-key');
  });

  it('does not loop when an acknowledgement arrives before the actual phone is verified', async () => {
    const send = vi.fn(async (config: InternalAxiosRequestConfig) => {
      throw new AxiosError('Phone required', 'ERR_BAD_RESPONSE', config, undefined, {
        config, status: 428, statusText: 'Precondition Required', headers: {}, data: {
          code: 'PARENT_SESSION_VERIFICATION_REQUIRED', parentSessionId: id, sensitivity: 'SENSITIVE_READ',
          serverNow: '2026-11-02T00:00:00Z', expiresAt: '2026-11-02T00:05:00Z' } });
    });
    apiClient.defaults.adapter = send;
    const present = vi.fn((prompt: SecurityPrompt) => prompt.complete({ actionProof: null }));
    unregister = securityChallenges.register(present);
    await expect(apiClient.get('/private/parent-not-yet-verified')).rejects.toThrow('phone session still needs verification');
    expect(send).toHaveBeenCalledTimes(2); expect(present).toHaveBeenCalledOnce();
  });
  it('preserves the exact body and idempotency key and performs one admitted change', async () => {
    const calls: Array<{ data: unknown; key: unknown; proof: unknown }> = [];
    let admitted = 0;
    apiClient.defaults.adapter = (async config => {
      const headers = AxiosHeaders.from(config.headers);
      calls.push({ data: config.data, key: headers.get('Idempotency-Key'), proof: headers.get('x-wiez-action-proof') });
      if (!headers.get('x-wiez-action-proof')) throw challenge(config);
      admitted++;
      return { config, status: 201, statusText: 'Created', headers: {}, data: { success: true } };
    }) satisfies AxiosAdapter;
    unregister = securityChallenges.register(prompt => prompt.complete({ actionProof: proof }));
    await apiClient.post('/subscriptions/brands/test/checkout', { quoteId: 'held-price', expectedAmountNgn: '12000' },
      { headers: { 'Idempotency-Key': 'same-operation' } });
    expect(calls).toHaveLength(2); expect(admitted).toBe(1);
    expect(calls[1].data).toBe(calls[0].data); expect(calls[1].key).toBe(calls[0].key);
    expect(calls[0].proof).toBeUndefined(); expect(calls[1].proof).toBe(proof);
  });
  it('supports first enrollment then exact approval without an infinite prompt loop', async () => {
    let count = 0;
    apiClient.defaults.adapter = async config => {
      count++; if (count <= 2) throw challenge(config, count === 1);
      return { config, status: 200, statusText: 'OK', headers: {}, data: {} };
    };
    unregister = securityChallenges.register(prompt => prompt.complete(prompt.challenge.code === 'MFA_ENROLLMENT_REQUIRED'
      ? { actionProof: null, enrolled: true } : { actionProof: proof }));
    await apiClient.post('/sensitive/change', { exact: 'same' }); expect(count).toBe(3);
  });
  it('stops if an already verified operation has changed, without silently approving it again', async () => {
    const send = vi.fn(async (config: InternalAxiosRequestConfig) => { throw challenge(config); });
    apiClient.defaults.adapter = send;
    const present = vi.fn((prompt: SecurityPrompt) => prompt.complete({ actionProof: proof }));
    unregister = securityChallenges.register(present);
    await expect(apiClient.post('/sensitive/change', {})).rejects.toThrow('Review it again');
    expect(send).toHaveBeenCalledTimes(2); expect(present).toHaveBeenCalledOnce();
  });
  it('does not trigger verification or repeat a write after a network failure', async () => {
    const send = vi.fn(async () => { throw new AxiosError('Offline', 'ERR_NETWORK'); });
    apiClient.defaults.adapter = send; const present = vi.fn(); unregister = securityChallenges.register(present);
    await expect(apiClient.post('/sensitive/change', {})).rejects.toMatchObject({ code: 'ERR_NETWORK' });
    expect(send).toHaveBeenCalledOnce(); expect(present).not.toHaveBeenCalled();
  });
  it('cancels a late 401 from the previous account without signing out the next account', async () => {
    let fail!: () => void;
    const send = vi.fn((config: InternalAxiosRequestConfig) => new Promise((_resolve, reject) => {
      fail = () => reject(new AxiosError('Expired', 'ERR_BAD_RESPONSE', config, undefined,
        { config, status: 401, statusText: 'Unauthorized', headers: {}, data: {} }));
    }));
    apiClient.defaults.adapter = send as AxiosAdapter;
    const result = apiClient.post('/sensitive/change', {});
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce());
    const expired = vi.fn(); window.addEventListener('auth:expired', expired);
    persistAccessToken(token(sid)); fail();
    await expect(result).rejects.toMatchObject({ code: 'ERR_CANCELED' });
    expect(send).toHaveBeenCalledOnce(); expect(expired).not.toHaveBeenCalled();
    window.removeEventListener('auth:expired', expired);
  });
});
