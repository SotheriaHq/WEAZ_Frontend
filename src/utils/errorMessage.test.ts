import { describe, it, expect } from 'vitest';
import { AxiosError } from 'axios';
import { getFriendlyErrorMessage } from './errorMessage';

describe('getFriendlyErrorMessage', () => {
  it('converts Axios timeout error into friendly connection timeout message', () => {
    const timeoutErr = new AxiosError('timeout of 15000ms exceeded', 'ECONNABORTED');
    const result = getFriendlyErrorMessage(timeoutErr, 'Sign in failed');
    expect(result).toBe('Connection timed out. Please check your internet connection and try again.');
  });

  it('converts network error without response into connection error message', () => {
    const networkErr = new AxiosError('Network Error', 'ERR_NETWORK');
    const result = getFriendlyErrorMessage(networkErr, 'Sign in failed');
    expect(result).toBe('Unable to connect to the server. Please check your internet connection and try again.');
  });

  it('converts 429 status code into rate limit message', () => {
    const rateLimitErr = new AxiosError('Request failed with status code 429', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 429,
      statusText: 'Too Many Requests',
      headers: {},
      config: {} as any,
      data: { message: 'ThrottlerException: Too Many Requests' },
    });
    const result = getFriendlyErrorMessage(rateLimitErr, 'Sign in failed');
    expect(result).toBe('Too many requests. Please wait a moment and try again.');
  });

  it('converts 500 server error into friendly server error message', () => {
    const serverErr = new AxiosError('Internal Server Error', 'ERR_BAD_RESPONSE', undefined, undefined, {
      status: 500,
      statusText: 'Internal Server Error',
      headers: {},
      config: {} as any,
      data: { message: 'Internal Server Error' },
    });
    const result = getFriendlyErrorMessage(serverErr, 'Sign in failed');
    expect(result).toBe('Something went wrong on our server. Please try again in a few moments.');
  });

  it('preserves clean custom backend message when available', () => {
    const customErr = new AxiosError('Bad Request', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: {} as any,
      data: { message: 'Verification code has expired' },
    });
    const result = getFriendlyErrorMessage(customErr, 'Sign in failed');
    expect(result).toBe('Verification code has expired');
  });

  it('replaces raw "Validation failed" with fallback message', () => {
    const validationErr = new AxiosError('Bad Request', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: {} as any,
      data: { message: 'Validation failed' },
    });
    const result = getFriendlyErrorMessage(validationErr, 'Please check your information and try again.');
    expect(result).toBe('Please check your information and try again.');
  });

  it('extracts structured email error into friendly email guidance', () => {
    const structuredErr = new AxiosError('Bad Request', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: {} as any,
      data: {
        message: 'Validation failed',
        errors: [{ property: 'email', constraints: ['email must be an email'] }],
      },
    });
    const result = getFriendlyErrorMessage(structuredErr, 'Sign in failed');
    expect(result).toBe('Please enter a valid email address (e.g. name@example.com).');
  });

  const withResponse = (status: number, data: Record<string, unknown>) =>
    new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
      status,
      statusText: '',
      headers: {},
      config: {} as any,
      data,
    });

  it('keeps sign-in failures vague', () => {
    expect(getFriendlyErrorMessage(withResponse(401, { message: 'Invalid email or password' }), 'x')).toBe('Invalid credentials');
    expect(getFriendlyErrorMessage(withResponse(401, { message: 'Malformed refresh token' }), 'x')).toBe('Invalid credentials');
  });

  it('shows a plain "not found" as written instead of calling it a credentials problem', () => {
    expect(getFriendlyErrorMessage(withResponse(404, { message: 'Refund not found' }), 'Unable to verify this refund.')).toBe('Refund not found');
    expect(getFriendlyErrorMessage(withResponse(400, { message: 'Invalid or expired code' }), 'x')).toBe('Invalid or expired code');
  });

  it('never shows database, framework or validation internals', () => {
    const fallback = 'Unable to save this tier.';
    for (const message of [
      'Unique constraint failed on the fields: (`code`)',
      'Invalid `prisma.order.update()` invocation',
      'insert or update on table "Ledger" violates foreign key constraint',
      'property internalNote should not exist',
      'Validation failed (uuid is expected)',
      'HttpException',
    ]) {
      expect(getFriendlyErrorMessage(withResponse(400, { message }), fallback)).toBe(fallback);
    }
    expect(
      getFriendlyErrorMessage(withResponse(400, { message: 'Validation failed', errors: [{ property: 'tier', messages: ['property tier should not exist'] }] }), fallback),
    ).toBe(fallback);
    expect(getFriendlyErrorMessage(new Error('Cannot read properties of undefined'), fallback)).toBe(fallback);
  });
});
