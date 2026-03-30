import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import type { RootState } from '@/store';
import { setUser } from '@/features/userSlice';
import { brandApi } from '@/api/BrandApi';
import VerificationHero from '@/components/studio/verification/VerificationHero';
import VerificationHistoryPanel from '@/components/studio/verification/VerificationHistoryPanel';
import {
  getVerificationCallToAction,
  verificationStatusLabel,
  verificationStatusTone,
} from '@/components/studio/verification/verificationShared';
import type { VerificationInfoItem, VerificationStatusResponse } from '@/types/verification';

export default function StoreVerificationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.user.profile);
  const brandId = user?.id;

  const [status, setStatus] = useState<VerificationStatusResponse | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [countdownNow, setCountdownNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdownNow(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!brandId) return;

    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const [data, draft] = await Promise.all([
          brandApi.getVerificationStatus(brandId),
          brandApi.getVerificationDraft(brandId),
        ]);
        if (!active) return;
        setStatus(data);
        const draftData = draft?.draftData;
        const draftHasValues =
          !!draft?.lastSavedAt ||
          Object.values(draftData ?? {}).some((value) => {
            if (typeof value === 'string') return value.trim().length > 0;
            if (typeof value === 'number') return Number.isFinite(value);
            if (!value || typeof value !== 'object') return false;
            return Object.values(value as Record<string, unknown>).some((nested) =>
              typeof nested === 'string' ? nested.trim().length > 0 : nested != null,
            );
          });
        setHasDraft(draftHasValues);
        if (user) {
          dispatch(
            setUser({
              ...user,
              verificationStatus: data.verificationStatus,
              isVerifiedBrand: data.badgeState.isVerifiedBrand,
              verificationBadgeVisible: data.badgeState.verificationBadgeVisible,
              verifiedExplanationUrl: data.badgeState.verifiedExplanationUrl,
            }),
          );
        }
      } catch (error: any) {
        if (!active) return;
        toast.error(
          error?.response?.data?.message ||
            'Unable to load verification status',
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [brandId, dispatch]);

  const callToAction = useMemo(
    () =>
      status?.verificationStatus === 'NOT_SUBMITTED' && hasDraft
        ? {
            primaryLabel: 'Continue draft process',
            primaryTo: '/studio/verification/apply',
          }
        : getVerificationCallToAction(status),
    [hasDraft, status],
  );

  const statusDisplayLabel =
    status?.verificationStatus === 'NOT_SUBMITTED' && hasDraft
      ? 'Drafted'
      : verificationStatusLabel(status?.verificationStatus);

  const handleCancel = async () => {
    if (!brandId || !status) return;
    try {
      setSaving(true);
      await brandApi.cancelVerification(brandId, status.updatedAt);
      const refreshed = await brandApi.getVerificationStatus(brandId, {
        force: true,
      });
      setStatus(refreshed);
      toast.success('Verification request cancelled');
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          'Unable to cancel the verification request',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleNudgePreference = async (nudgeOptOut: boolean) => {
    if (!brandId) return;
    try {
      setSaving(true);
      const response = await brandApi.setVerificationNudgeOptOut(
        brandId,
        nudgeOptOut,
      );
      setStatus((current) =>
        current
          ? {
              ...current,
              nudgeOptOut: response.nudgeOptOut,
              updatedAt: response.updatedAt,
            }
          : current,
      );
      toast.success(
        nudgeOptOut
          ? 'Verification reminders turned off'
          : 'Verification reminders turned back on',
      );
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          'Unable to update reminder preference',
      );
    } finally {
      setSaving(false);
    }
  };

  const infoItems = status?.infoRequestedItems ?? [];
  const cooldownTarget = useMemo(() => {
    if (!status) return null;

    if (status.cooldownExpiresAt) {
      const parsed = new Date(status.cooldownExpiresAt);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if (status.cooldownRemainingDays > 0) {
      return new Date(countdownNow + status.cooldownRemainingDays * 24 * 60 * 60 * 1000);
    }

    return null;
  }, [countdownNow, status]);
  const cooldownRemainingText = useMemo(() => {
    if (!cooldownTarget) return null;

    const diffMs = cooldownTarget.getTime() - countdownNow;
    if (diffMs <= 0) return 'You can reapply now';

    const totalHours = Math.floor(diffMs / (60 * 60 * 1000));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    return `${days} day${days === 1 ? '' : 's'}, ${hours} hour${hours === 1 ? '' : 's'} remaining`;
  }, [cooldownTarget, countdownNow]);

  const handlePrimaryAction = () => {
    if (
      callToAction.primaryTo === '/studio/verification' &&
      (status?.verificationStatus === 'PENDING' ||
        status?.verificationStatus === 'IN_REVIEW')
    ) {
      const target = document.getElementById('verification-current-state');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }

    navigate(callToAction.primaryTo, {
      state: {
        from: `${location.pathname}${location.search}${location.hash}`,
      },
    });
  };

  const heroPrimaryLabel =
    callToAction.primaryTo === '/studio/verification' &&
    (status?.verificationStatus === 'PENDING' ||
      status?.verificationStatus === 'IN_REVIEW')
      ? 'View status'
      : callToAction.primaryLabel;

  if (loading) {
    return (
      <div className="rounded-[2rem] border border-gray-200 bg-white p-8 text-sm text-gray-500 shadow-sm">
        Loading verification workspace...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
        <Link to="/studio/store" className="transition hover:text-gray-700">
          Store
        </Link>
        <span>/</span>
        <span className="text-gray-800">Verification</span>
      </nav>

      <VerificationHero
        eyebrow="Seller trust"
        title="Verification workspace"
        description="Track your status, review your badge state, and jump back into the submission flow only when action is required."
        statusLabel={statusDisplayLabel}
        statusTone={verificationStatusTone(status?.verificationStatus)}
        actions={
          <div className="flex flex-wrap gap-3">
            <Button
              size="sm"
              onClick={handlePrimaryAction}
            >
              {heroPrimaryLabel}
            </Button>
            {status &&
            (status.verificationStatus === 'PENDING' ||
              status.verificationStatus === 'IN_REVIEW' ||
              status.verificationStatus === 'ADDITIONAL_INFO_REQUESTED') ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void handleCancel()}
                disabled={saving}
              >
                Cancel request
              </Button>
            ) : null}
          </div>
        }
      />

      {status?.verificationStatus === 'REJECTED' &&
      status.rejectionReasons.length > 0 ? (
        <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-600">
            Review outcome
          </p>
          <ul className="mt-4 space-y-2 text-sm text-rose-800">
            {status.rejectionReasons.map((reason) => (
              <li key={`${reason.code}-${reason.label}`}>• {reason.label}</li>
            ))}
          </ul>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-rose-200/80 bg-white/80 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">
                Applied on
              </p>
              <p className="mt-2 text-sm font-semibold text-rose-900">
                {status.verificationSubmittedAt
                  ? new Date(status.verificationSubmittedAt).toLocaleString()
                  : 'Not recorded'}
              </p>
            </div>
            <div className="rounded-2xl border border-rose-200/80 bg-white/80 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">
                Next reapply window
              </p>
              {status.cooldownRemainingDays > 0 && cooldownTarget ? (
                <>
                  <p className="mt-2 text-sm font-semibold text-rose-900">
                    {cooldownTarget.toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-rose-700">
                    {cooldownRemainingText}
                  </p>
                </>
              ) : (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-emerald-700">
                    You can reapply now
                  </p>
                  <Button
                    size="sm"
                    onClick={() =>
                      navigate('/studio/verification/apply', {
                        state: {
                          from: `${location.pathname}${location.search}${location.hash}`,
                        },
                      })
                    }
                  >
                    Start new attempt
                  </Button>
                </div>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {status?.verificationStatus === 'ADDITIONAL_INFO_REQUESTED' ? (
        <section className="rounded-[1.75rem] border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
            More information requested
          </p>
          {status.infoRequestMessage ? (
            <p className="mt-3 text-sm leading-6 text-amber-900">
              {status.infoRequestMessage}
            </p>
          ) : null}
          {infoItems.length > 0 ? (
            <ul className="mt-4 space-y-3 text-sm text-amber-900">
              {infoItems.map((item: VerificationInfoItem) => (
                <li
                  key={`${item.field}-${item.label}`}
                  className="rounded-2xl border border-amber-200 bg-white/80 px-4 py-3"
                >
                  <span className="font-semibold">{item.label}</span>
                  {item.message ? `: ${item.message}` : ''}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-5">
            <Button
              size="sm"
              onClick={() =>
                navigate('/studio/verification/apply', {
                  state: {
                    from: `${location.pathname}${location.search}${location.hash}`,
                  },
                })
              }
            >
              Continue with corrections
            </Button>
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <section
            id="verification-current-state"
            className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
                  Current state
                </p>
                <h2 className="mt-3 text-2xl font-black text-gray-900">
                  {status?.badgeState.isVerifiedBrand
                    ? 'Badge is active'
                    : 'Badge is not active'}
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-7 text-gray-600">
                  Badge visibility is calculated from your verification status,
                  store state, and account state. This keeps the public trust
                  signal aligned with the real store state.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[280px]">
                <div className="rounded-3xl border border-sky-200 bg-sky-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-600">
                    Status
                  </p>
                  <p className="mt-2 text-sm font-semibold text-sky-900">
                    {statusDisplayLabel}
                  </p>
                </div>
                <div className="rounded-3xl border border-gray-200 bg-gray-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
                    Attempt
                  </p>
                  <p className="mt-2 text-sm font-semibold text-gray-900">
                    {status?.verificationAttemptNumber ?? 0}
                  </p>
                </div>
                <div className={`rounded-3xl border px-4 py-4 ${
                  status?.cooldownRemainingDays
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-emerald-200 bg-emerald-50'
                }`}>
                  <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${
                    status?.cooldownRemainingDays ? 'text-amber-600' : 'text-emerald-600'
                  }`}>
                    Cooldown
                  </p>
                  <p className={`mt-2 text-sm font-semibold ${
                    status?.cooldownRemainingDays ? 'text-amber-900' : 'text-emerald-900'
                  }`}>
                    {status?.cooldownRemainingDays
                      ? cooldownRemainingText ?? `${status.cooldownRemainingDays} day(s)`
                      : 'No lockout'}
                  </p>
                  {status?.cooldownRemainingDays && cooldownTarget ? (
                    <p className="mt-1 text-xs text-amber-700">
                      Reapply on {cooldownTarget.toLocaleString()}
                    </p>
                  ) : null}
                </div>
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600">
                    Reminders
                  </p>
                  <p className="mt-2 text-sm font-semibold text-emerald-900">
                    {status?.nudgeOptOut ? 'Off' : 'On'}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <VerificationHistoryPanel attempts={status?.attemptHistory ?? []} />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
              Next action
            </p>
            <p className="mt-3 text-lg font-bold text-gray-900">
              {callToAction.primaryLabel}
            </p>
            <p className="mt-2 text-sm leading-7 text-gray-600">
              Use the guided wizard for submissions, corrections, and letter
              signing. The form saves draft data as you move through the steps.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={handlePrimaryAction}>
                {heroPrimaryLabel}
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  void handleNudgePreference(!(status?.nudgeOptOut ?? false))
                }
                disabled={saving}
              >
                {status?.nudgeOptOut
                  ? 'Turn reminders on'
                  : 'Turn reminders off'}
              </Button>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
              Timeline
            </p>
            <div className="mt-4 space-y-3 text-sm text-gray-600">
              <p>
                Last submitted:{' '}
                {status?.verificationSubmittedAt
                  ? new Date(status.verificationSubmittedAt).toLocaleString()
                  : 'Not yet'}
              </p>
              <p>
                Last reviewed:{' '}
                {status?.verificationReviewedAt
                  ? new Date(status.verificationReviewedAt).toLocaleString()
                  : 'Not yet'}
              </p>
              <p>
                Current record version:{' '}
                <span className="font-medium text-gray-900">
                  {status?.updatedAt
                    ? new Date(status.updatedAt).toLocaleString()
                    : 'Unknown'}
                </span>
              </p>
            </div>
          </section>

          {status?.badgeState.verifiedExplanationUrl ? (
            <section className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
                Public explanation
              </p>
              <p className="mt-3 text-sm leading-7 text-gray-600">
                The badge explanation is reusable across store, product, and
                profile surfaces so public trust copy stays consistent.
              </p>
              <Link
                to={status.badgeState.verifiedExplanationUrl}
                className="mt-4 inline-flex text-sm font-semibold text-sky-700 transition hover:text-sky-800"
              >
                Open badge explanation route
              </Link>
            </section>
          ) : null}
        </div>
      </section>
    </div>
  );
}
