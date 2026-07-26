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
    <div className="space-y-8 bg-surface min-h-screen">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/studio/verification', { state: { from: originPath } })}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-outline-variant/30 bg-surface-container-lowest text-on-surface-variant shadow-sm transition-all hover:bg-surface-container-low hover:text-on-surface"
          aria-label="Back to verification"
        >
          ←
        </button>
        <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
          <Link to={originPath} className="transition hover:text-primary">
            {originLabel}
          </Link>
          <span className="text-outline-variant">/</span>
          <Link
            to="/studio/verification"
            className="transition hover:text-primary"
          >
            Verification
          </Link>
          <span className="text-outline-variant">/</span>
          <span className="text-primary font-bold">Submitted</span>
        </nav>
      </div>

      <VerificationHero
        eyebrow="Submission complete 🎉"
        title="Verification Sent for Review"
        description="Your evidence package is now cryptographically locked for compliance reviewer evaluation. Track review progress from your status workspace."
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

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">
            What Happens Next
          </p>
          <div className="space-y-3 text-xs leading-relaxed text-on-surface-variant">
            <p>• WIEZ compliance team reviews submissions sequentially in order of receipt.</p>
            <p>
              • If additional information or document correction is needed, field-specific notifications will appear on your workspace.
            </p>
            <p>
              • Upon approval, your verified brand badge becomes active across all storefront items.
            </p>
          </div>
        </div>

        <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-tertiary mb-3">
            Current Submission Record
          </p>
          <div className="space-y-3 text-xs text-on-surface">
            <p className="flex justify-between border-b border-outline-variant/20 pb-2">
              <span className="text-on-surface-variant">Status:</span>
              <span className="font-bold text-primary">
                {verificationStatusLabel(status?.verificationStatus)}
              </span>
            </p>
            <p className="flex justify-between border-b border-outline-variant/20 pb-2">
              <span className="text-on-surface-variant">Attempt:</span>
              <span className="font-bold">
                #{status?.verificationAttemptNumber ?? 1}
              </span>
            </p>
            <p className="flex justify-between">
              <span className="text-on-surface-variant">Submitted at:</span>
              <span className="font-semibold">
                {status?.verificationSubmittedAt
                  ? new Date(status.verificationSubmittedAt).toLocaleString()
                  : 'Just now'}
              </span>
            </p>
          </div>
          <Link
            to="/studio/verification"
            className="mt-5 inline-flex text-xs font-bold text-primary hover:underline"
          >
            View full verification timeline →
          </Link>
        </section>
      </section>

      <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-sm">
        <VerificationHistoryPanel attempts={status?.attemptHistory ?? []} />
      </div>
    </div>
  );
}
