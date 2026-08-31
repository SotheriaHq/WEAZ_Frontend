import React, { useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';

import { apiClient } from '@/api/httpClient';
import { setUser } from '@/features/userSlice';
import { useEmbeddedSurface } from '@/hooks/useEmbeddedSurface';
import {
  needsGenderPrompt,
  PROFILE_GENDER_OPTIONS,
  PROFILE_GENDER_PROMPT,
  type ProfileGender,
} from '@/lib/profileGender';
import type { RootState } from '@/store';

const SKIP_PATHS = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify',
  '/legal',
  '/accept-invite',
  '/account-reactivation',
];

export const GenderPrompt: React.FC = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const user = useSelector((state: RootState) => state.user.profile);
  const isAuthenticated = useSelector(
    (state: RootState) => state.user.isAuthenticated,
  );
  const embedded = useEmbeddedSurface();
  const [saving, setSaving] = useState<ProfileGender | null>(null);

  const hidden = SKIP_PATHS.some(
    (path) =>
      location.pathname === path || location.pathname.startsWith(`${path}/`),
  );

  const open =
    isAuthenticated &&
    Boolean(user?.id) &&
    needsGenderPrompt(user?.gender) &&
    !hidden &&
    embedded !== 'mobile-app';

  const handleSelect = useCallback(
    async (gender: ProfileGender) => {
      if (!user || saving) return;
      setSaving(gender);
      try {
        const response = await apiClient.patch('/users/me/profile', { gender });
        const payload = response.data?.data ?? response.data;
        const updated = payload?.user ?? payload;
        dispatch(
          setUser({
            ...user,
            gender: updated?.gender ?? gender,
          }),
        );
      } catch {
        toast.error('Unable to save that just now. Please try again.');
      } finally {
        setSaving(null);
      }
    },
    [dispatch, saving, user],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gender-prompt-title"
    >
      <div className="w-full max-w-md rounded-3xl border border-[color:var(--bd-subtle)] bg-[color:var(--surface-raised,white)] p-6 shadow-2xl dark:bg-zinc-950">
        <p className="text-xs font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
          A moment
        </p>
        <h2
          id="gender-prompt-title"
          className="mt-2 text-2xl font-black tracking-tight text-theme"
        >
          {PROFILE_GENDER_PROMPT.title}
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-theme-secondary">
          {PROFILE_GENDER_PROMPT.body}
        </p>
        <p className="mt-5 text-sm font-semibold text-theme">
          {PROFILE_GENDER_PROMPT.question}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {PROFILE_GENDER_OPTIONS.map((option) => {
            const busy = saving === option.value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={Boolean(saving)}
                onClick={() => void handleSelect(option.value)}
                className="min-h-12 rounded-2xl border border-indigo-200/80 bg-indigo-50/70 px-3 py-3 text-sm font-bold text-indigo-900 transition hover:border-indigo-400 hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--menu-focus-ring)] disabled:opacity-60 dark:border-indigo-500/30 dark:bg-indigo-950/40 dark:text-indigo-100 dark:hover:bg-indigo-900/50"
              >
                {busy ? 'Saving…' : option.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
