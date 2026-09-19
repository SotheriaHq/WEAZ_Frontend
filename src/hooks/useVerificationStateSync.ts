import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRealtime } from '@/realtime/RealtimeProvider';
import { queryClient } from '@/query/queryClient';
import { queryKeys } from '@/query/queryKeys';
import { setUser } from '@/features/userSlice';
import { apiClient } from '@/api/httpClient';
import { unwrapApiResponse } from '@/types/auth';
import type { AuthUserDto } from '@/types/auth';
import type { RootState } from '@/store';

/**
 * Refresh the signed-in brand's session when an admin changes its verification
 * state.
 *
 * The verified badge is derived server-side on every request
 * (`getBrandVerificationTruth`) — it is not a stored flag — so the API always
 * tells the truth. The client, however, keeps the auth profile in Redux and
 * localStorage and only refetched it on login or a hard reload. An admin could
 * therefore approve a brand and the owner's studio and storefront would keep
 * rendering the old, unverified state indefinitely.
 *
 * The backend already emits a notification for each of these transitions, so we
 * piggyback on that rather than adding a new socket event: when one lands for
 * this user, refetch `/auth/profile` and push the fresh snapshot into Redux.
 */
const VERIFICATION_NOTIFICATION_TYPES = new Set([
  'VERIFICATION_APPROVED',
  'VERIFICATION_REJECTED',
  'VERIFICATION_IN_REVIEW',
  'VERIFICATION_INFO_REQUESTED',
  'VERIFICATION_SUBMITTED',
]);

export function useVerificationStateSync(): void {
  const dispatch = useDispatch();
  const { onNotification } = useRealtime();
  const userId = useSelector((state: RootState) => state.user.profile?.id) ?? null;

  useEffect(() => {
    if (!userId) return;

    return onNotification((payload: { type?: string } | null | undefined) => {
      const type = typeof payload?.type === 'string' ? payload.type : '';
      if (!VERIFICATION_NOTIFICATION_TYPES.has(type)) return;

      void (async () => {
        try {
          const response = await apiClient.get('/auth/profile', {
            headers: { 'Cache-Control': 'no-cache' },
            params: { _verificationSyncTs: Date.now().toString() },
          });
          const profilePayload = unwrapApiResponse<
            { user?: AuthUserDto } | AuthUserDto
          >(response.data);
          const user =
            profilePayload && 'user' in profilePayload
              ? profilePayload.user
              : (profilePayload as AuthUserDto);
          if (!user?.id) return;

          dispatch(setUser(user));
          // Drop the cached profile so any component reading it through the
          // query cache re-renders against the new verification truth too.
          queryClient.setQueryData(queryKeys.auth.profile(), profilePayload);
          await queryClient.invalidateQueries({ queryKey: queryKeys.auth.profile() });
        } catch {
          // A failed refresh is not worth surfacing: the next navigation or
          // reload picks up the correct state anyway.
        }
      })();
    });
  }, [dispatch, onNotification, userId]);
}

export default useVerificationStateSync;
