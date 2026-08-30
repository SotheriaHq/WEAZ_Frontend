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
import { showNotice } from '@/components/ui/NoticeModal';

/**
 * Profile → Apply → Review → Active. Named so the rail, the "Step n of N"
 * heading and the completion check cannot drift apart.
 */
const VERIFICATION_JOURNEY_STEPS = [1, 2, 3, 4] as const;
const TOTAL_VERIFICATION_STEPS = VERIFICATION_JOURNEY_STEPS.length;

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
  const storePending = status?.storeReadiness?.pending ?? [];
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
    // Never let the owner walk the whole evidence wizard only to be refused at
    // submit. Point them at the outstanding store step instead.
    if (
      storePending.length > 0 &&
      callToAction.primaryTo === '/studio/verification/apply'
    ) {
      const first = storePending[0];
      showNotice({
        title: 'Finish your store first',
        message: `Verification opens once your store is complete and published. Still to do: ${storePending
          .map((step) => step.label)
          .join(', ')}.`,
        action: {
          label: `Go to: ${first.label}`,
          onSelect: () =>
            navigate(first.href, {
              state: {
                from: `${location.pathname}${location.search}${location.hash}`,
              },
            }),
        },
      });
      return;
    }

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
    return 2;
  }, [status]);

  if (loading) {
    return <StudioPageSkeleton variant="detail" />;
  }

  return (
    <div className="space-y-8 bg-surface min-h-screen">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/studio/store')}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-outline-variant/30 bg-surface-container-lowest text-on-surface-variant shadow-sm transition hover:bg-surface-container-low hover:text-on-surface"
          aria-label="Back to store"
        >
          ←
        </button>
        <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
          <Link to="/studio/store" className="transition hover:text-primary">
            Store
          </Link>
          <span className="text-outline-variant">/</span>
          <span className="text-primary font-bold">Verification</span>
        </nav>
      </div>

      {/* Progress Stepper Banner */}
      <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_8px_32px_rgba(109,35,249,0.04)] relative overflow-hidden">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant mb-1">
              Verification Workspace
            </p>
            <h2 className="text-xl font-bold text-on-surface">
              {currentStep === 4
                ? 'Step 4 of 4 — Badge is Active 🎉'
                : currentStep === 3
                  ? 'Step 3 of 4 — Under WIEZ Review'
                  : 'Step 2 of 4 — Identity & Evidence Submission'}
            </h2>
          </div>
          <div className="flex flex-1 max-w-md items-center gap-4">
            {VERIFICATION_JOURNEY_STEPS.map((step) => {
              const label =
                step === 1
                  ? 'Profile'
                  : step === 2
                    ? 'Apply'
                    : step === 3
                      ? 'Review'
                      : 'Active';
              // Step 4 (`Active`) is a TERMINAL state, not work in progress.
              //
              // `isDone = step < currentStep` left the final segment rendering
              // as "current" — pale `bg-tertiary` with a pulse — on a brand
              // whose badge was already live. So an approved brand saw a header
              // reading "Step 4 of 4 — Badge is Active 🎉" above a rail whose
              // last bar was visibly unfilled, and the pulse implied something
              // was still running. The journey is finished; fill it.
              const isFlowComplete = currentStep === TOTAL_VERIFICATION_STEPS;
              const isDone =
                step < currentStep || (isFlowComplete && step === currentStep);
              const isCurrent = step === currentStep && !isDone;
              return (
                <div key={step} className="flex flex-1 flex-col items-center gap-2">
                  <div
                    className={`h-2 w-full rounded-full transition-all duration-500 ${
                      isDone
                        ? 'bg-primary'
                        : isCurrent
                          ? 'bg-tertiary animate-pulse'
                          : 'bg-surface-container-highest'
                    }`}
                  />
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      isDone || isCurrent
                        ? 'text-primary'
                        : 'text-on-surface-variant/60'
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

      {/* Store-readiness gate.
          A verified badge needs an APPROVED verification AND an open store, so
          verifying before the store is finished produces an approval that
          changes nothing visible — the brand assumes it failed. Block entry here
          and link to the exact step that is outstanding. */}
      {storePending.length > 0 &&
      status?.verificationStatus !== 'APPROVED' &&
      status?.verificationStatus !== 'PENDING' &&
      status?.verificationStatus !== 'IN_REVIEW' ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-800 dark:text-amber-300">
            ⚠️ Finish your store first
          </p>
          <p className="mt-2 text-sm leading-relaxed text-amber-900 dark:text-amber-300">
            You can apply for verification once your store is complete and published.
            Being verified only shows a badge on an open store, so we hold the
            application until these are done:
          </p>
          <ul className="mt-4 space-y-2">
            {storePending.map((step) => (
              <li key={step.code}>
                <Link
                  to={step.href}
                  state={{
                    from: `${location.pathname}${location.search}${location.hash}`,
                  }}
                  className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white/80 p-3 text-sm text-amber-900 transition hover:border-amber-300 hover:bg-theme dark:border-amber-500/30 dark:text-amber-300"
                >
                  <span className="font-semibold">{step.label}</span>
                  <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                    Fix →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {status?.verificationStatus === 'REJECTED' &&
      status.rejectionReasons.length > 0 ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm dark:border-rose-500/30 dark:bg-rose-500/10">
          <p className="text-xs font-bold uppercase tracking-widest text-rose-700 dark:text-rose-300">
            Review Outcome Feedback
          </p>
          <ul className="mt-3 space-y-2 text-xs text-rose-900 dark:text-rose-300">
            {status.rejectionReasons.map((reason) => (
              <li key={`${reason.code}-${reason.label}`}>• {reason.label}</li>
            ))}
          </ul>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-rose-200/80 bg-white/80 p-4 dark:border-rose-500/30">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600">
                Applied on
              </p>
              <p className="mt-1 text-xs font-semibold text-rose-950">
                {status.verificationSubmittedAt
                  ? new Date(status.verificationSubmittedAt).toLocaleString()
                  : 'Not recorded'}
              </p>
            </div>
            <div className="rounded-xl border border-rose-200/80 bg-white/80 p-4 dark:border-rose-500/30">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600">
                Reapply Window
              </p>
              {status.cooldownRemainingDays > 0 && cooldownTarget ? (
                <>
                  <p className="mt-1 text-xs font-semibold text-rose-950">
                    {cooldownTarget.toLocaleString()}
                  </p>
                  <p className="mt-0.5 text-[11px] text-rose-700 dark:text-rose-300">
                    {cooldownRemainingText}
                  </p>
                </>
              ) : (
                <div className="mt-1 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    Eligible to reapply now
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
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-800 dark:text-amber-300">
            More Information Requested
          </p>
          {status.infoRequestMessage ? (
            <p className="mt-2 text-xs leading-relaxed text-amber-900 dark:text-amber-300">
              {status.infoRequestMessage}
            </p>
          ) : null}
          {infoItems.length > 0 ? (
            <ul className="mt-4 space-y-2 text-xs text-amber-900 dark:text-amber-300">
              {infoItems.map((item: VerificationInfoItem) => (
                <li
                  key={`${item.field}-${item.label}`}
                  className="rounded-xl border border-amber-200 bg-white/80 p-3 dark:border-amber-500/30"
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

      {/* Main Content Bento Grid */}
      <section className="grid gap-6 lg:grid-cols-10">
        {/* Left Sidebar (40%) */}
        <div className="space-y-6 lg:col-span-4">
          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-sm" id="verification-current-state">
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">
              Store Badge Status
            </p>
            
            {/* Prominent badge display */}
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-outline-variant/40 bg-surface-container-low p-6 text-center">
              <span className="text-4xl mb-2">
                {status?.badgeState.isVerifiedBrand ? '🛡️' : '⚠️'}
              </span>
              <h3 className={`text-lg font-extrabold ${
                status?.badgeState.isVerifiedBrand 
                  ? 'text-emerald-700 dark:text-emerald-300' 
                  : 'text-amber-700 dark:text-amber-300'
              }`}>
                {status?.badgeState.isVerifiedBrand ? 'Verified Brand' : 'Verification Incomplete'}
              </h3>
              <p className="mt-2 text-xs text-on-surface-variant max-w-xs">
                {status?.badgeState.isVerifiedBrand
                  ? 'Your trust badge is displayed across storefronts, catalog items, and brand cards.'
                  : 'Complete verification to earn your official WIEZ verification badge.'}
              </p>
            </div>

            {/* Status Pills */}
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
                <span className="text-xs text-on-surface-variant">Verification Status</span>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                  status?.verificationStatus === 'APPROVED'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                    : status?.verificationStatus === 'REJECTED'
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300'
                      : status?.verificationStatus === 'PENDING' || status?.verificationStatus === 'IN_REVIEW'
                        ? 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                  {statusDisplayLabel}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
                <span className="text-xs text-on-surface-variant">Attempt Number</span>
                <span className="text-xs font-bold text-on-surface">
                  {status?.verificationAttemptNumber ?? 0} attempt(s)
                </span>
              </div>

              {/* Reminders Toggle Switch */}
              <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
                <div>
                  <span className="text-xs text-on-surface-variant font-medium">Email Reminders</span>
                  <p className="text-[10px] text-on-surface-variant/70">Nudge updates when action is required</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleNudgePreference(!(status?.nudgeOptOut ?? false))}
                  disabled={saving}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    status?.nudgeOptOut
                      ? 'bg-surface-container-high'
                      : 'bg-primary'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      status?.nudgeOptOut ? 'translate-x-0' : 'translate-x-4'
                    }`}
                  />
                </button>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <span className="text-xs font-medium text-on-surface-variant">Reapply Lockout</span>
                <div className={`rounded-xl border p-3 ${
                  status?.cooldownRemainingDays
                    ? 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10'
                    : 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10'
                }`}>
                  <p className={`text-xs font-semibold ${
                    status?.cooldownRemainingDays ? 'text-amber-800 dark:text-amber-300' : 'text-emerald-800 dark:text-emerald-300'
                  }`}>
                    {status?.cooldownRemainingDays
                      ? cooldownRemainingText ?? `${status.cooldownRemainingDays} day(s)`
                      : 'No active lockout'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Main Section (60%) */}
        <div className="space-y-6 lg:col-span-6">
          {/* Next Action Bento Card */}
          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full pointer-events-none"></div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">
              Next Recommended Action
            </p>
            <h3 className="text-lg font-bold text-on-surface">
              {callToAction.primaryLabel}
            </h3>
            <p className="mt-2 text-xs text-on-surface-variant leading-relaxed">
              Complete your verification sequence to earn verified brand status. Draft state saves automatically.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={handlePrimaryAction} className="rounded-xl px-5 shadow-sm">
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

          {/* Verification Checklist */}
          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">
              Verification Flow Checklist
            </p>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-on-primary">✓</span>
                <div>
                  <p className="text-xs font-bold text-on-surface">1. Setup Store Profile</p>
                  <p className="text-[11px] text-on-surface-variant">Storefront name, brand username, and logo configured.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  currentStep >= 2
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}>2</span>
                <div>
                  <p className="text-xs font-bold text-on-surface">2. Provide Legal & Evidence Details</p>
                  <p className="text-[11px] text-on-surface-variant">Provide legal identity, CAC number, business address, and ID uploads.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  currentStep >= 3
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}>3</span>
                <div>
                  <p className="text-xs font-bold text-on-surface">3. Digital Signature & Review</p>
                  <p className="text-[11px] text-on-surface-variant">Sign the legal letter to submit into the compliance review queue.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* History Log Section */}
      <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-sm">
        <VerificationHistoryPanel attempts={status?.attemptHistory ?? []} />
      </div>
    </div>
  );
}
