import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSecurityChallengeBroker, parseSecurityChallenge, securityIdentityFromToken,
  type SecurityChallenge, type SecurityPrompt } from './securityChallenge';

const id = '11111111-1111-4111-8111-111111111111';
const sid = '22222222-2222-4222-8222-222222222222';
const proof = `${id}.${'A'.repeat(43)}`;
const challenge = (critical = true): SecurityChallenge => ({ code: 'STEP_UP_REQUIRED',
  sensitivity: critical ? 'CRITICAL_CHANGE' : 'SENSITIVE_READ', challengeId: id,
  deadline: 5000, review: { title: 'Approve this action' } });
const jwt = (claims: object) => `e30.${btoa(JSON.stringify(claims)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}.sig`;
afterEach(() => vi.useRealTimers());

describe('security verification cancellation identity', () => {
  it('stays stable across token rotation but changes for a new session or revision', () => {
    const claims = { sub: id, sid, authVersion: 4, role: 'BRAND', exp: 1 };
    const read = (extra: object) => securityIdentityFromToken(jwt({ ...claims, ...extra }), atob);
    expect(read({ exp: 2 })).toBe(read({ exp: 1 }));
    expect(read({ sid: id })).not.toBe(read({}));
    expect(read({ authVersion: 5 })).not.toBe(read({}));
  });
  it('rejects missing session binding, invalid claims and malformed tokens', () => {
    for (const token of [null, 'bad', jwt({ sub: id }), jwt({ sub: id, sid, authVersion: -1, role: 'ADMIN' })])
      expect(securityIdentityFromToken(token, atob)).toBeNull();
  });
});

describe('challenge metadata', () => {
  it('keeps a parent-session challenge distinct from MFA enrollment and action approvals', () => {
    const data = { code: 'PARENT_SESSION_VERIFICATION_REQUIRED', sensitivity: 'SENSITIVE_READ', parentSessionId: sid,
      serverNow: '2026-11-02T00:00:00Z', expiresAt: '2026-11-02T00:05:00Z' };
    expect(parseSecurityChallenge(data, 0, () => 1)).toMatchObject({ code: data.code, parentSessionId: sid, challengeId: undefined });
    expect(parseSecurityChallenge({ ...data, parentSessionId: 'invalid' }, 0, () => 1)).toBeNull();
    expect(parseSecurityChallenge({ ...data, sensitivity: 'CRITICAL_CHANGE' }, 0, () => 1)).toBeNull();
  });
  it('uses server duration and monotonic request latency, not local wall-clock time', () => {
    vi.spyOn(Date, 'now').mockReturnValue(9999999999999);
    const parsed = parseSecurityChallenge({ data: { code: 'STEP_UP_REQUIRED', sensitivity: 'CRITICAL_CHANGE',
      challengeId: id, serverNow: '2026-11-02T00:00:00Z', expiresAt: '2026-11-02T00:05:00Z',
      review: { title: 'Payment', amountNgn: '123.45', password: 'private', accountEnding: '1234567890' } } }, 1000, () => 2000);
    expect(parsed?.deadline).toBe(301000);
    expect(parsed?.review).toEqual({ title: 'Payment', amountNgn: '123.45', monthlyPriceNgn: undefined });
    vi.restoreAllMocks();
  });
  it('rejects expired, overlong and malformed challenges', () => {
    const data = { code: 'STEP_UP_REQUIRED', sensitivity: 'SENSITIVE_READ', challengeId: id,
      serverNow: '2026-11-02T00:00:00Z', expiresAt: '2026-11-02T00:05:00Z' };
    expect(parseSecurityChallenge(data, 0, () => 300000)).toBeNull();
    expect(parseSecurityChallenge({ ...data, expiresAt: '2026-11-02T00:06:00Z' }, 0, () => 0)).toBeNull();
    expect(parseSecurityChallenge({ ...data, challengeId: 'bad' }, 0, () => 0)).toBeNull();
  });
});

describe('single verification presenter', () => {
  it('never lets a child MFA prompt satisfy a phone challenge or joins different parent sessions', async () => {
    const broker = createSecurityChallengeBroker(() => 0); let active!: SecurityPrompt;
    broker.register(prompt => { active = prompt; });
    const parent: SecurityChallenge = { ...challenge(false), code: 'PARENT_SESSION_VERIFICATION_REQUIRED', parentSessionId: sid };
    const pending = broker.request(parent, 'child', () => 'child');
    await expect(broker.request(challenge(false), 'child', () => 'child')).rejects.toThrow('Finish the current');
    await expect(broker.request({ ...parent, parentSessionId: id }, 'child', () => 'child')).rejects.toThrow('Finish the current');
    active.complete({ actionProof: proof }); expect((await pending).actionProof).toBeNull();
    const child = broker.request(challenge(), 'child', () => 'child');
    await expect(broker.request(parent, 'child', () => 'child')).rejects.toThrow('Finish the current');
    active.complete({ actionProof: proof }); expect((await child).actionProof).toBe(proof);
  });
  function setup() {
    vi.useFakeTimers();
    const broker = createSecurityChallengeBroker(() => performance.now());
    let prompt!: SecurityPrompt;
    const dismiss = vi.fn();
    broker.register(value => { prompt = value; return dismiss; });
    return { broker, dismiss, prompt: () => prompt };
  }
  it('shares a viewing window with reads while keeping the critical proof exclusive', async () => {
    const s = setup();
    const critical = s.broker.request(challenge(), 'actor', () => 'actor');
    const read = s.broker.request(challenge(false), 'actor', () => 'actor');
    s.prompt().complete({ actionProof: proof });
    expect(await critical).toEqual({ actionProof: proof });
    expect((await read).actionProof).toBeNull();
    expect(s.dismiss).toHaveBeenCalledOnce();
  });
  it('never forwards a proof returned for a sensitive read', async () => {
    const s = setup(); const result = s.broker.request(challenge(false), 'actor', () => 'actor');
    s.prompt().complete({ actionProof: proof });
    expect(await result).toEqual({ actionProof: null });
  });
  it('does not silently queue another critical change', async () => {
    const s = setup(); const first = s.broker.request(challenge(), 'actor', () => 'actor');
    await expect(s.broker.request(challenge(), 'actor', () => 'actor')).rejects.toThrow('Finish the current');
    s.prompt().cancel(); await expect(first).rejects.toMatchObject({ code: 'ERR_CANCELED' });
  });
  it('makes a cancelled prompt stale immediately, before any closing animation or replacement', async () => {
    const s = setup(); const result = s.broker.request(challenge(), 'actor', () => 'actor');
    const prompt = s.prompt(); expect(prompt.isCurrent()).toBe(true);
    prompt.cancel(); expect(prompt.isCurrent()).toBe(false);
    await expect(result).rejects.toMatchObject({ code: 'ERR_CANCELED' });
  });
  it('cancels an old account and ignores its late completion', async () => {
    const s = setup(); const first = s.broker.request(challenge(), 'old', () => 'old'); const old = s.prompt();
    const rejected = expect(first).rejects.toMatchObject({ code: 'ERR_CANCELED' });
    const second = s.broker.request(challenge(), 'new', () => 'new');
    old.complete({ actionProof: proof });
    s.prompt().complete({ actionProof: proof });
    await rejected; expect((await second).actionProof).toBe(proof);
  });
  it('rejects completion after authority changes even when the screen is still mounted', async () => {
    const s = setup(); let actor = 'old';
    const result = s.broker.request(challenge(), actor, () => actor); actor = 'new';
    s.prompt().complete({ actionProof: proof });
    await expect(result).rejects.toMatchObject({ code: 'ERR_CANCELED' });
  });
  it('cancels a read independently without cancelling the critical approval', async () => {
    const s = setup(); const first = s.broker.request(challenge(), 'actor', () => 'actor');
    const controller = new AbortController();
    const read = s.broker.request(challenge(false), 'actor', () => 'actor', controller.signal);
    controller.abort(); await expect(read).rejects.toMatchObject({ code: 'ERR_CANCELED' });
    s.prompt().complete({ actionProof: proof }); expect((await first).actionProof).toBe(proof);
  });
  it('expires a joined read on its own deadline', async () => {
    const s = setup(); const first = s.broker.request(challenge(), 'actor', () => 'actor');
    const read = s.broker.request({ ...challenge(false), deadline: 50 }, 'actor', () => 'actor');
    const rejected = expect(read).rejects.toMatchObject({ code: 'ERR_CANCELED' });
    await vi.advanceTimersByTimeAsync(51); await rejected;
    s.prompt().complete({ actionProof: proof }); expect((await first).actionProof).toBe(proof);
  });
  it('expires the active prompt and cleans up listeners', async () => {
    const s = setup(); const result = s.broker.request(challenge(), 'actor', () => 'actor');
    const rejected = expect(result).rejects.toMatchObject({ code: 'ERR_CANCELED' });
    await vi.advanceTimersByTimeAsync(5001); await rejected;
    expect(s.dismiss).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });
  it('handles synchronous completion and stale presenter cleanup safely', async () => {
    const broker = createSecurityChallengeBroker(() => 0); const dismiss = vi.fn();
    const old = broker.register(() => undefined);
    broker.register(prompt => { prompt.complete({ actionProof: proof }); return dismiss; }); old();
    expect((await broker.request(challenge(), 'actor', () => 'actor')).actionProof).toBe(proof);
    expect(dismiss).toHaveBeenCalledOnce();
  });
  it('requires successful enrollment and rejects malformed action proofs', async () => {
    const s = setup();
    const first = s.broker.request({ ...challenge(), code: 'MFA_ENROLLMENT_REQUIRED' }, 'actor', () => 'actor');
    s.prompt().complete({ actionProof: proof }); await expect(first).rejects.toThrow('could not be confirmed');
    const second = s.broker.request(challenge(), 'actor', () => 'actor');
    s.prompt().complete({ actionProof: `${'-'.repeat(36)}.${'A'.repeat(43)}` });
    await expect(second).rejects.toThrow('could not be confirmed');
  });
});
