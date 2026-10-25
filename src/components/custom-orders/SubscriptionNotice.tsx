import { lazy, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import type { RootState } from '@/store';
import { getActiveBrandId, isBrandOwner } from '@/lib/brandAccess';
import { brandSubscriptionApi } from '@/api/BrandSubscriptionApi';
import { useEmbeddedSurface } from '@/hooks/useEmbeddedSurface';
import { DeferredOverlay } from '@/components/ui/DeferredOverlay';
const Modal = lazy(() => import('@/components/ui/Modal'));

type Notice = NonNullable<
  Awaited<ReturnType<typeof brandSubscriptionApi.claimNotice>>['notice']
>;
export function SubscriptionNotice() {
  const profile = useSelector((state: RootState) => state.user.profile);
  const authenticated = useSelector(
    (state: RootState) => state.user.isAuthenticated,
  );
  const brandId = getActiveBrandId(profile);
  const owner = Boolean(
    authenticated && brandId && isBrandOwner(profile, brandId),
  );
  const location = useLocation();
  const navigate = useNavigate();
  const embedded = useEmbeddedSurface() === 'mobile-app';
  const [notice, setNotice] = useState<{
    value: Notice;
    identity: string;
  } | null>(null);
  const identity = `${profile?.id || ''}:${brandId || ''}`;
  const request = useRef<{
    key: string;
    promise: ReturnType<typeof brandSubscriptionApi.claimNotice>;
  } | null>(null);
  const shown = useRef(new Map<string, number>());
  const studio = location.pathname.startsWith('/studio');
  const blocked =
    /\/(?:login|signup|verify|forgot-password|reset-password|legal|accept-invite|account-reactivation)(?:\/|$)/.test(
      location.pathname,
    ) || /\/studio\/store\/(?:setup|essentials)/.test(location.pathname);
  useEffect(() => {
    if (
      !owner ||
      blocked ||
      !brandId ||
      embedded ||
      location.pathname.startsWith('/settings') ||
      location.pathname.startsWith('/checkout') ||
      location.search.includes('subscriptionReference') ||
      location.search.includes('tab=subscription')
    )
      return;
    const key = `${identity}:${studio ? 'studio' : 'login'}`;
    if ((shown.current.get(key) ?? 0) > Date.now()) return;
    if (request.current?.key !== key)
      request.current = {
        key,
        promise: brandSubscriptionApi.claimNotice(brandId),
      };
    let active = true;
    void request.current.promise
      .then((result) => {
        if (request.current?.key === key) request.current = null;
        if (active) {
          shown.current.set(
            key,
            Date.now() + (result.notice ? 24 * 60 * 60_000 : 15_000),
          );
          if (result.notice) setNotice({ value: result.notice, identity });
        }
      })
      .catch(() => {
        if (request.current?.key === key) request.current = null;
      });
    return () => {
      active = false;
    };
  }, [
    owner,
    brandId,
    identity,
    studio,
    embedded,
    location.pathname,
    location.search,
    blocked,
  ]);
  const current =
    notice?.identity === identity && owner && !blocked ? notice.value : null;
  function close() {
    setNotice(null);
    if (brandId)
      void brandSubscriptionApi.dismissNotice(brandId).catch(() => undefined);
  }
  return (
    <DeferredOverlay open={Boolean(current)}><Modal
      open={Boolean(current)}
      onClose={close}
      title={current?.title}
      size="sm"
    >
      <div className="space-y-5">
        <span className="text-3xl" aria-hidden="true">
          🧵
        </span>
        <p className="text-base leading-7">{current?.message}</p>
        <div className="flex flex-wrap items-center gap-5">
          <button
            className="queue-button bg-violet-700 text-white"
            onClick={() => {
              close();
              navigate('/settings?tab=subscription-billing&from=studio');
            }}
          >
            Upgrade
          </button>
          <button className="min-h-11 font-medium" onClick={close}>
            Maybe later
          </button>
        </div>
      </div>
    </Modal></DeferredOverlay>
  );
}
