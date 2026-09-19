import { describe, expect, it, beforeEach } from 'vitest';
import userReducer, { setUser, clearUser } from './userSlice';
import type { AuthUserDto } from '../types/auth';

const baseUser = (overrides: Partial<AuthUserDto> = {}): AuthUserDto =>
  ({
    id: 'user-a',
    email: 'a@example.com',
    username: 'user_a',
    firstName: 'Ada',
    lastName: 'A',
    type: 'REGULAR',
    role: 'User',
    isEmailVerified: true,
    ...overrides,
  }) as AuthUserDto;

describe('userSlice identity isolation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('merges partial updates for the same user id', () => {
    const loggedIn = userReducer(undefined, setUser(baseUser()));
    const next = userReducer(
      loggedIn,
      setUser(
        baseUser({
          firstName: 'Ada Updated',
          profileImage: 'https://cdn.example.com/a.jpg',
        }),
      ),
    );

    expect(next.profile?.id).toBe('user-a');
    expect(next.profile?.email).toBe('a@example.com');
    expect(next.profile?.firstName).toBe('Ada Updated');
    expect(next.profile?.profileImage).toBe('https://cdn.example.com/a.jpg');
  });

  it('does not merge fields across different user ids (prevents navbar franken-identity)', () => {
    const loggedIn = userReducer(undefined, setUser(baseUser()));
    // Simulate a bug path that previously merged brand-B public fields into
    // the authenticated session via setUser(partial with different id).
    const contaminated = userReducer(
      loggedIn,
      setUser(
        baseUser({
          id: 'brand-owner-b',
          firstName: 'Hover',
          lastName: 'Covers',
          email: 'private-owner@example.com',
          username: 'hovercovers',
          profileImage: 'https://cdn.example.com/brand-b.jpg',
        }),
      ),
    );

    expect(contaminated.profile?.id).toBe('brand-owner-b');
    expect(contaminated.profile?.email).toBe('private-owner@example.com');
    // Must NOT retain user-a's identity fields after an id switch.
    expect(contaminated.profile?.username).toBe('hovercovers');
    expect(contaminated.profile?.firstName).toBe('Hover');
  });

  it('clearUser drops session identity completely', () => {
    const loggedIn = userReducer(undefined, setUser(baseUser()));
    const cleared = userReducer(loggedIn, clearUser());
    expect(cleared.profile).toBeNull();
    expect(cleared.isAuthenticated).toBe(false);
  });
});
