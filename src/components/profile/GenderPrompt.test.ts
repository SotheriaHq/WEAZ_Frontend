import { describe, expect, it } from 'vitest';

import { isGenderPromptSuppressedPath } from './GenderPrompt';
import { needsGenderPrompt } from '@/lib/profileGender';

describe('isGenderPromptSuppressedPath', () => {
  it('suppresses the email verification screen', () => {
    // The reported bug: the list said `/verify` and the matcher accepted only
    // an exact hit or a `/verify/` prefix, so `/verify-email` fell through and
    // the sizing modal opened over "your email is verified".
    expect(isGenderPromptSuppressedPath('/verify-email')).toBe(true);
  });

  it.each([
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/verify',
    '/verify-email',
    '/legal/privacy',
    '/accept-invite/xyz',
    '/account-reactivation',
    '/admin',
    '/admin/users',
  ])('suppresses %s', (pathname) => {
    expect(isGenderPromptSuppressedPath(pathname)).toBe(true);
  });

  it.each(['/', '/runway', '/market', '/profile', '/bag', '/studio'])(
    'still asks on %s',
    (pathname) => {
      expect(isGenderPromptSuppressedPath(pathname)).toBe(false);
    },
  );
});

describe('needsGenderPrompt', () => {
  it('does not ask a console operator, who cannot shop', () => {
    expect(needsGenderPrompt({ gender: null, role: 'Admin' })).toBe(false);
    expect(needsGenderPrompt({ gender: null, role: 'SuperAdmin' })).toBe(false);
  });

  it('asks a shopper who has not answered', () => {
    expect(needsGenderPrompt({ gender: null, role: 'User' })).toBe(true);
    expect(needsGenderPrompt({ gender: null })).toBe(true);
  });

  it('does not re-ask once answered, including a declined answer', () => {
    expect(needsGenderPrompt({ gender: 'FEMALE' })).toBe(false);
    // "I'd rather not say" is an answer, not an absence of one.
    expect(needsGenderPrompt({ gender: 'UNSPECIFIED' })).toBe(false);
  });

  it('handles a missing account', () => {
    expect(needsGenderPrompt(null)).toBe(false);
    expect(needsGenderPrompt(undefined)).toBe(false);
  });
});
