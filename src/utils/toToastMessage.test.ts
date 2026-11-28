import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { toToastMessage } from './errorMessage';

/**
 * WIEZ-P01B-0001: handlers passed whatever was thrown straight to
 * toast.error(). An object there crashed <Toaster> and, through the root
 * boundary, the whole app. Whatever is thrown, a toast now gets a string.
 */
const axiosFailure = (status: number, data: unknown) => {
  const config = { headers: new AxiosHeaders() };
  const response = { status, statusText: '', headers: {}, config, data } as AxiosResponse;
  return new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_REQUEST', config, {}, response);
};

describe('toToastMessage', () => {
  const fallback = 'Failed to bag item';

  it.each([
    ['an AxiosError', axiosFailure(500, { message: 'Internal server error' })],
    ['an AxiosError with an array message', axiosFailure(400, { message: ['size must be set', 'colour must be set'] })],
    ['an AxiosError with an object message', axiosFailure(400, { message: { field: 'size' } })],
    ['a network failure', new AxiosError('Network Error', 'ERR_NETWORK')],
    ['an Error', new Error('boom')],
    ['a rejected thunk object', { name: 'Error', message: undefined }],
    ['a plain object', { field: 'size' }],
    ['an array', ['a', 'b']],
    ['null', null],
    ['undefined', undefined],
    ['a number', 42],
  ])('returns a non-empty string for %s', (_label, thrown) => {
    const message = toToastMessage(thrown, fallback);
    expect(typeof message).toBe('string');
    expect(message.trim()).not.toBe('');
  });

  it('uses the server message when it is plain copy', () => {
    expect(toToastMessage(axiosFailure(409, { message: 'This size is sold out.' }), fallback)).toBe('This size is sold out.');
  });

  it('never shows axios wording or validation arrays; uses the caller copy instead', () => {
    expect(toToastMessage(axiosFailure(400, { message: ['size must be set'] }), fallback)).toBe(fallback);
  });

  it('treats a 401 as an expired session, not a wrong password', () => {
    expect(toToastMessage(axiosFailure(401, { message: 'Unauthorized' }), fallback)).toBe('Please sign in to continue.');
  });

  it('keeps a plain string and drops a technical one', () => {
    expect(toToastMessage('  Already in your bag.  ', fallback)).toBe('Already in your bag.');
    expect(toToastMessage('PrismaClientKnownRequestError P2002', fallback)).toBe(fallback);
    expect(toToastMessage('   ', fallback)).toBe(fallback);
  });

  it('keeps the friendly wording for timeouts and lost connections', () => {
    expect(toToastMessage(new AxiosError('timeout of 15000ms exceeded', 'ECONNABORTED'), fallback)).toMatch(/timed out/i);
    expect(toToastMessage(new AxiosError('Network Error', 'ERR_NETWORK'), fallback)).toMatch(/connect/i);
  });
});
