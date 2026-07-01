import React, { useEffect, useState } from 'react';
import { Flag } from 'lucide-react';
import { toast } from 'sonner';
import Modal from '@/components/ui/Modal';
import UniversalSelect from '@/components/forms/UniversalSelect';
import { contentIntegrityApi } from '@/api/AdminApi';
import { unwrapApiResponse } from '@/types/auth';
import type {
  ContentReportReasonCode,
  ContentReportTargetType,
  ContentReasonOption,
} from '@/types/admin';

interface ReportContentButtonProps {
  targetType: ContentReportTargetType;
  targetId: string;
  mediaId?: string | null;
  label?: string;
  className?: string;
}

const ReportContentButton: React.FC<ReportContentButtonProps> = ({
  targetType,
  targetId,
  mediaId,
  label = 'Report',
  className,
}) => {
  const [open, setOpen] = useState(false);
  const [reasons, setReasons] = useState<Array<{ value: string; label: string }>>([]);
  const [reasonCode, setReasonCode] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!open || reasons.length > 0) return;

    contentIntegrityApi.getReportReasonCodes()
      .then((response) => {
        if (!mounted) return;
        const payload = unwrapApiResponse<ContentReasonOption<ContentReportReasonCode>[]>(
          response.data as any,
        );
        setReasons(payload.map((reason) => ({ value: reason.code, label: reason.label })));
      })
      .catch(() => {
        if (mounted) setError('Report reasons are unavailable right now.');
      });

    return () => {
      mounted = false;
    };
  }, [open, reasons.length]);

  const submitReport = async () => {
    if (!reasonCode) {
      setError('Select a report reason.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await contentIntegrityApi.reportContent({
        targetType,
        targetId,
        mediaId: mediaId ?? undefined,
        reasonCode: reasonCode as ContentReportReasonCode,
        note: note.trim() || undefined,
      });
      const report = unwrapApiResponse<{ duplicate?: boolean }>(response.data as any);
      setSubmitted(true);
      toast.success(report?.duplicate ? 'Report already submitted' : 'Report submitted');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={submitted}
        className={className}
      >
        <Flag size={14} />
        {submitted ? 'Reported' : label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Report content" size="md" backdropStyle="light">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Send this product or design media to WIEZ review. Reports do not remove content automatically.
          </p>
          <UniversalSelect
            label="Reason"
            value={reasonCode}
            onChange={(value) => {
              setReasonCode(value);
              setError(null);
            }}
            options={reasons}
            placeholder="Select a reason"
            error={error ?? undefined}
            selectedAllowWrap
            optionAllowWrap
          />
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={4}
            maxLength={1000}
            placeholder="Optional details"
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
          {submitted && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
              Thanks. This report is now in the review queue.
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/8"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => void submitReport()}
              disabled={submitting || submitted}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {submitting ? 'Reporting...' : 'Submit report'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default ReportContentButton;
