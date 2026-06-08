import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import VerificationHero from '@/components/studio/verification/VerificationHero';
import VerificationHistoryPanel from '@/components/studio/verification/VerificationHistoryPanel';
import { brandApi } from '@/api/BrandApi';
import type { RootState } from '@/store';
import type { VerificationStatusResponse } from '@/types/verification';
import {
  verificationStatusLabel,
  verificationStatusTone,
} from '@/components/studio/verification/verificationShared';
import StudioPageSkeleton from '@/components/studio/StudioPageSkeleton';

export default function VerificationSubmittedPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector((state: RootState) => state.user.profile);
  const brandId = user?.id;

  const originPath =
    typeof (location.state as { from?: unknown } | null)?.from === 'string'
      ? String((location.state as { from?: string }).from)
      : '/studio/verification';
  const originLabel =
    originPath.startsWith('/studio/store')
      ? 'Store'
      : originPath.startsWith('/studio/verification')
        ? 'Verification'
        : 'Back';

  const [status, setStatus] = useState<VerificationStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!brandId) return;

    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const data = await brandApi.getVerificationStatus(brandId);
        if (!active) return;
        setStatus(data);
      } catch (error: any) {
        if (!active) return;
        toast.error(
          error?.response?.data?.message ||
            'Unable to load the verification submission summary',
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [brandId]);

  if (loading) {
    return <StudioPageSkeleton variant="detail" />;
  }

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
        <Link to={originPath} className="transition hover:text-gray-700">
          {originLabel}
        </Link>
        <span>/</span>
        <Link
          to="/studio/verification"
          className="transition hover:text-gray-700"
        >
          Verification
        </Link>
        <span>/</span>
        <span className="text-gray-800">Submitted</span>
      </nav>

      <VerificationHero
        eyebrow="Submission complete"
        title="Verification sent for review"
        description="Your current evidence set is locked for reviewer handling. Track the queue state from the workspace and only re-enter the wizard when WEAZ asks for updates."
        statusLabel={verificationStatusLabel(status?.verificationStatus)}
        statusTone={verificationStatusTone(status?.verificationStatus)}
        actions={
          <div className="flex flex-wrap gap-3">
            <Button size="sm" onClick={() => navigate('/studio/verification')}>
              Open status workspace
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate('/studio/store')}
            >
              Return to store
            </Button>
          </div>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
            What happens next
          </p>
          <div className="mt-5 space-y-4 text-sm leading-7 text-gray-600">
            <p>WEAZ reviewers pick up submissions from the queue in order.</p>
            <p>
              If more evidence is needed, the request will appear in your
              verification workspace with field-specific instructions.
            </p>
            <p>
              When approved, the badge only shows while the store and account
              remain in the eligible state.
            </p>
          </div>
        </div>

        <section className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
            Current record
          </p>
          <div className="mt-4 space-y-3 text-sm text-gray-600">
            <p>
              Status:{' '}
              <span className="font-semibold text-gray-900">
                {verificationStatusLabel(status?.verificationStatus)}
              </span>
            </p>
            <p>
              Attempt:{' '}
              <span className="font-semibold text-gray-900">
                {status?.verificationAttemptNumber ?? 0}
              </span>
            </p>
            <p>
              Submitted:{' '}
              <span className="font-semibold text-gray-900">
                {status?.verificationSubmittedAt
                  ? new Date(status.verificationSubmittedAt).toLocaleString()
                  : 'Not available'}
              </span>
            </p>
          </div>
          <Link
            to="/studio/verification"
            className="mt-5 inline-flex text-sm font-semibold text-sky-700 transition hover:text-sky-800"
          >
            View the full verification timeline
          </Link>
        </section>
      </section>

      <VerificationHistoryPanel attempts={status?.attemptHistory ?? []} />
    </div>
  );
}
