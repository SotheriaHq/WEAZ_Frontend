import React, { useEffect, useState } from 'react';
import { AlertTriangle, Edit3, Info } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { contentIntegrityApi } from '@/api/AdminApi';
import { unwrapApiResponse } from '@/types/auth';
import type { AdminContentSubmission } from '@/types/admin';
import { getContentStatusLabel, getMediaViewSlotLabel } from '@/utils/contentIntegrity';

interface ContentReviewDecisionModalProps {
  open: boolean;
  onClose: () => void;
  submissionId?: string | null;
  status?: string | null;
  title?: string | null;
  onEdit?: () => void;
}

const ContentReviewDecisionModal: React.FC<ContentReviewDecisionModalProps> = ({
  open,
  onClose,
  submissionId,
  status,
  title,
  onEdit,
}) => {
  const [submission, setSubmission] = useState<AdminContentSubmission | null>(null);
  const [loading, setLoading] = useState(false);
  const normalizedStatus = String(status ?? submission?.status ?? '').toUpperCase();
  const isRejected = normalizedStatus === 'REJECTED';

  useEffect(() => {
    let mounted = true;
    if (!open || !submissionId) {
      setSubmission(null);
      return;
    }

    setLoading(true);
    contentIntegrityApi.getMySubmission(submissionId)
      .then((response) => {
        if (!mounted) return;
        setSubmission(unwrapApiResponse<AdminContentSubmission>(response.data as any));
      })
      .catch(() => {
        if (!mounted) return;
        setSubmission(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [open, submissionId]);

  const reasonLabel = submission?.reasonLabel;
  const reasonNote = submission?.reasonNote;
  const missingSlots = submission?.slotCompleteness?.missing ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isRejected ? 'Rejected' : 'Changes requested'}
      size="md"
      backdropStyle="light"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
          {isRejected ? <AlertTriangle size={22} /> : <Info size={22} />}
          <div>
            <p className="font-semibold">
              {isRejected
                ? 'This submission was not approved.'
                : 'Please update the highlighted media and resubmit.'}
            </p>
            <p className="mt-1 text-sm opacity-85">
              {title || 'This item'} is currently marked as {getContentStatusLabel(normalizedStatus)}.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="h-28 animate-pulse rounded-xl bg-gray-100 dark:bg-white/8" />
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-gray-200 p-4 dark:border-white/10">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Reviewer reason
              </p>
              <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                {reasonLabel || 'Reviewer feedback is not available yet.'}
              </p>
              {reasonNote && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">
                  {reasonNote}
                </p>
              )}
            </div>

            {missingSlots.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/20 dark:bg-red-500/10">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-200">
                  Missing required media
                </p>
                <p className="mt-2 text-sm text-red-700 dark:text-red-100">
                  {missingSlots.map((slot) => getMediaViewSlotLabel(slot)).join(', ')}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/8"
          >
            Close
          </button>
          {onEdit && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit();
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
            >
              <Edit3 size={16} />
              Edit and Resubmit
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ContentReviewDecisionModal;
