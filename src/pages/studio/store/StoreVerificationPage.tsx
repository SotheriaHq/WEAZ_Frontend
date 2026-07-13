import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import type { RootState } from '@/store';
import { setUser } from '@/features/userSlice';
import { brandApi } from '@/api/BrandApi';
import VerificationHistoryPanel from '@/components/studio/verification/VerificationHistoryPanel';
import {
  getVerificationCallToAction,
  verificationStatusLabel,
} from '@/components/studio/verification/verificationShared';
import type { VerificationInfoItem, VerificationStatusResponse } from '@/types/verification';
import StudioPageSkeleton from '@/components/studio/StudioPageSkeleton';

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
        if (
          user &&
          (
            user.verificationStatus !== data.verificationStatus ||
            user.isVerifiedBrand !== data.badgeState.isVerifiedBrand ||
            user.verificationBadgeVisible !== data.badgeState.verificationBadgeVisible ||
            user.verifiedExplanationUrl !== data.badgeState.verifiedExplanationUrl
          )
        ) {
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
  }, [brandId, dispatch, user]);

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

  const currentStep = useMemo(() => {
    if (status?.badgeState.isVerifiedBrand) return 4;
    if (
      status?.verificationStatus === 'PENDING' ||
      status?.verificationStatus === 'IN_REVIEW'
    )
      return 3;
    return 2; // Default starting application flow
  }, [status]);

  if (loading) {
    return <StudioPageSkeleton variant="detail" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/studio/store')}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:border-gray-300 hover:bg-gray-50 dark:border-white/10 dark:bg-zinc-800 dark:text-gray-300 dark:hover:border-white/20 dark:hover:bg-zinc-700"
          aria-label="Back to store"
        >
          ←
        </button>
        <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
          <Link to="/studio/store" className="transition hover:text-gray-700">
            Store
          </Link>
          <span>/</span>
          <span className="text-gray-800 dark:text-zinc-300">Verification</span>
        </nav>
      </div>

      {/* Progress Stepper */}
      <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gray-400 dark:text-gray-500">
              Verification Stage
            </p>
            <h2 className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
              {currentStep === 4
                ? 'Step 4 of 4 — Badge is Active 🎉'
                : currentStep === 3
                  ? 'Step 3 of 4 — WIEZ Review'
                  : 'Step 2 of 4 — Identity & Documents'}
            </h2>
          </div>
          <div className="flex flex-1 max-w-md items-center gap-4">
            {[1, 2, 3, 4].map((step) => {
              const label =
                step === 1
                  ? 'Profile'
                  : step === 2
                    ? 'Apply'
                    : step === 3
                      ? 'Review'
                      : 'Active';
              const isDone = step < currentStep;
              const isCurrent = step === currentStep;
              return (
                <div key={step} className="flex flex-1 flex-col items-center gap-1.5">
                  <div
                    className={`h-2 w-full rounded-full transition-all duration-300 ${
                      isDone
                        ? 'bg-purple-600 dark:bg-purple-500'
                        : isCurrent
                          ? 'bg-amber-500 dark:bg-amber-400 animate-pulse'
                          : 'bg-gray-200 dark:bg-zinc-800'
                    }`}
                  />
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      isDone || isCurrent
                        ? 'text-gray-800 dark:text-zinc-200'
                        : 'text-gray-400 dark:text-zinc-600'
                    }`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {status?.verificationStatus === 'REJECTED' &&
      status.rejectionReasons.length > 0 ? (
        <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 shadow-sm dark:border-rose-900/30 dark:bg-rose-950/20">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-600 dark:text-rose-400">
            Review outcome
          </p>
          <ul className="mt-4 space-y-2 text-sm text-rose-800 dark:text-rose-300">
            {status.rejectionReasons.map((reason) => (
              <li key={`${reason.code}-${reason.label}`}>• {reason.label}</li>
            ))}
          </ul>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-rose-200/80 bg-white/80 px-4 py-4 dark:border-rose-900/30 dark:bg-zinc-900/80">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500 dark:text-rose-400">
                Applied on
              </p>
              <p className="mt-2 text-sm font-semibold text-rose-900 dark:text-rose-250">
                {status.verificationSubmittedAt
                  ? new Date(status.verificationSubmittedAt).toLocaleString()
                  : 'Not recorded'}
              </p>
            </div>
            <div className="rounded-2xl border border-rose-200/80 bg-white/80 px-4 py-4 dark:border-rose-900/30 dark:bg-zinc-900/80">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500 dark:text-rose-400">
                Next reapply window
              </p>
              {status.cooldownRemainingDays > 0 && cooldownTarget ? (
                <>
                  <p className="mt-2 text-sm font-semibold text-rose-900 dark:text-rose-250">
                    {cooldownTarget.toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">
                    {cooldownRemainingText}
                  </p>
                </>
              ) : (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
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
        <section className="rounded-[1.75rem] border border-amber-200 bg-amber-50 p-6 shadow-sm dark:border-amber-900/30 dark:bg-amber-950/20">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700 dark:text-amber-400">
            More information requested
          </p>
          {status.infoRequestMessage ? (
            <p className="mt-3 text-sm leading-6 text-amber-900 dark:text-amber-300">
              {status.infoRequestMessage}
            </p>
          ) : null}
          {infoItems.length > 0 ? (
            <ul className="mt-4 space-y-3 text-sm text-amber-900 dark:text-amber-300">
              {infoItems.map((item: VerificationInfoItem) => (
                <li
                  key={`${item.field}-${item.label}`}
                  className="rounded-2xl border border-amber-200 bg-white/80 px-4 py-3 dark:border-amber-900/30 dark:bg-zinc-900/80"
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

      {/* Main content grid */}
      <section className="grid gap-6 lg:grid-cols-10">
        {/* Left Sidebar (40%) */}
        <div className="space-y-6 lg:col-span-4">
          <div className="rounded-[1.75rem] border border-gray-200/80 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400 dark:text-gray-500">
              Badge Status
            </p>
            
            {/* Prominent badge display */}
            <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 py-8 text-center dark:border-white/10 dark:bg-zinc-950">
              <span className="text-4xl mb-3">
                {status?.badgeState.isVerifiedBrand ? '🛡️' : '⚠️'}
              </span>
              <h3 className={`text-xl font-black ${
                status?.badgeState.isVerifiedBrand 
                  ? 'text-emerald-600 dark:text-emerald-400' 
                  : 'text-amber-600 dark:text-amber-400'
              }`}>
                {status?.badgeState.isVerifiedBrand ? 'Verified Brand' : 'Not Active'}
              </h3>
              <p className="mt-2 px-4 text-xs text-gray-500 dark:text-gray-400">
                {status?.badgeState.isVerifiedBrand
                  ? 'Your trust badge is displayed on your storefront and products.'
                  : 'Submit verification evidence to unlock the verified badge.'}
              </p>
            </div>

            {/* Status Pills */}
            <div className="mt-6 space-y-3.5">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3.5 dark:border-white/5">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Verification Status</span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  status?.verificationStatus === 'APPROVED'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                    : status?.verificationStatus === 'REJECTED'
                      ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                      : status?.verificationStatus === 'PENDING' || status?.verificationStatus === 'IN_REVIEW'
                        ? 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                }`}>
                  {statusDisplayLabel}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-gray-100 pb-3.5 dark:border-white/5">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Attempts</span>
                <span className="text-xs font-semibold text-gray-900 dark:text-white">
                  {status?.verificationAttemptNumber ?? 0} attempt(s)
                </span>
              </div>

              {/* Reminders Toggle Switch layout */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-3.5 dark:border-white/5">
                <div>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Email Reminders</span>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">Nudge updates when action is required</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleNudgePreference(!(status?.nudgeOptOut ?? false))}
                  disabled={saving}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    status?.nudgeOptOut
                      ? 'bg-gray-200 dark:bg-zinc-800'
                      : 'bg-purple-600 dark:bg-purple-500'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      status?.nudgeOptOut ? 'translate-x-0' : 'translate-x-4'
                    }`}
                  />
                </button>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Reapply Cooldown</span>
                <div className={`rounded-xl border p-3 ${
                  status?.cooldownRemainingDays
                    ? 'border-amber-200 bg-amber-50/50 dark:border-amber-500/20 dark:bg-amber-500/5'
                    : 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/5'
                }`}>
                  <p className={`text-xs font-semibold ${
                    status?.cooldownRemainingDays ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'
                  }`}>
                    {status?.cooldownRemainingDays
                      ? cooldownRemainingText ?? `${status.cooldownRemainingDays} day(s)`
                      : 'No active lockout'}
                  </p>
                  {status?.cooldownRemainingDays && cooldownTarget ? (
                    <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-500">
                      Eligible on {cooldownTarget.toLocaleString()}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Main Section (60%) */}
        <div className="space-y-6 lg:col-span-6">
          {/* Next Action Hero Card */}
          <div className="rounded-[1.75rem] border border-gray-200 bg-gradient-to-br from-white to-slate-50/80 p-6 shadow-sm dark:border-white/10 dark:bg-gradient-to-br dark:from-zinc-900 dark:to-zinc-950">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400 dark:text-gray-500">
              Next Action
            </p>
            <h3 className="mt-3 text-lg font-black text-gray-900 dark:text-white">
              {callToAction.primaryLabel}
            </h3>
            <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
              Use the guided wizard to complete profile verification. The form preserves your draft data automatically as you proceed through the steps.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={handlePrimaryAction} className="rounded-xl px-5 shadow-[0_4px_20px_rgba(124,58,237,0.18)]">
                {heroPrimaryLabel}
              </Button>
              {status &&
              (status.verificationStatus === 'PENDING' ||
                status.verificationStatus === 'IN_REVIEW' ||
                status.verificationStatus === 'ADDITIONAL_INFO_REQUESTED') ? (
                <Button
                  variant="ghost"
                  onClick={() => void handleCancel()}
                  disabled={saving}
                  className="rounded-xl"
                >
                  Cancel request
                </Button>
              ) : null}
            </div>
          </div>

          {/* Guided steps checklist */}
          <div className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400 dark:text-gray-500">
              Verification Checklist
            </p>
            <div className="mt-4 space-y-4">
              <div className="flex items-start gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">✓</span>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">1. Setup Profile & Brand</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Setup your display name, username, and logo on WIEZ.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  currentStep >= 2
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400'
                    : 'bg-gray-100 text-gray-400 dark:bg-zinc-800'
                }`}>2</span>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">2. Submit Identity & Documents</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Provide legal representative details, business address, and upload official ID document.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  currentStep >= 3
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400'
                    : 'bg-gray-100 text-gray-400 dark:bg-zinc-800'
                }`}>3</span>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">3. Signature & Review</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Sign the legal confirmation letter. A WIEZ reviewer will pick up your application.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline details */}
          <div className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400 dark:text-gray-500">
              Timeline Summary
            </p>
            <div className="mt-4 space-y-3 text-xs text-gray-600 dark:text-gray-400">
              <div className="flex items-center justify-between border-b border-gray-55 pb-2.5 dark:border-white/5">
                <span>Last submitted:</span>
                <span className="font-semibold text-gray-950 dark:text-white">
                  {status?.verificationSubmittedAt
                    ? new Date(status.verificationSubmittedAt).toLocaleString()
                    : 'Not yet'}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-gray-55 pb-2.5 dark:border-white/5">
                <span>Last reviewed:</span>
                <span className="font-semibold text-gray-950 dark:text-white">
                  {status?.verificationReviewedAt
                    ? new Date(status.verificationReviewedAt).toLocaleString()
                    : 'Not yet'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Record version:</span>
                <span className="font-semibold text-gray-950 dark:text-white">
                  {status?.updatedAt
                    ? new Date(status.updatedAt).toLocaleString()
                    : 'Unknown'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Public explanation section */}
      {status?.badgeState.verifiedExplanationUrl ? (
        <details className="group rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer items-center justify-between focus:outline-none">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400 dark:text-gray-500">
                Public Explanation
              </p>
              <h3 className="mt-1 text-sm font-bold text-gray-900 dark:text-white">
                Learn what the verification badge represents
              </h3>
            </div>
            <span className="ml-1.5 shrink-0 rounded-full bg-gray-50 p-1.5 text-gray-900 transition group-open:-rotate-180 dark:bg-zinc-800 dark:text-white">
              ⌄
            </span>
          </summary>
          
          <div className="mt-4 border-t border-gray-100 pt-4 dark:border-white/5">
            <p className="text-sm leading-7 text-gray-600 dark:text-gray-400">
              The verification badge explanation copy is standard and reusable across WIEZ store, product, and profile pages, ensuring clear and consistent trust communication.
            </p>
            <div className="mt-4">
              <Link
                to={status.badgeState.verifiedExplanationUrl}
                className="inline-flex text-sm font-semibold text-sky-700 transition hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300"
              >
                Open badge explanation route →
              </Link>
            </div>
          </div>
        </details>
      ) : null}

      {/* Attempt History Section at the bottom */}
      <div className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <VerificationHistoryPanel attempts={status?.attemptHistory ?? []} />
      </div>
    </div>
  );
}
