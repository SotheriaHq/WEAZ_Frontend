import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import Modal from '@/components/ui/Modal';
import { adminContentReviewApi, type BrandAutoPublishStatus } from '@/api/AdminApi';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { unwrapApiResponse } from '@/types/auth';

type Props = {
  brandId: string;
  brandName?: string | null;
};

/**
 * A brand's auto-publish switch, shown beside its trust tier in content review.
 *
 * With auto-publish on, the brand's designs and products go live without
 * review. Everyone who can open review sees the state; only holders of
 * contentReview.autoPublish.manage (SuperAdmin always) can change it, and every
 * change asks for a reason, which the server writes to the audit log.
 */
export default function BrandAutoPublishCard({ brandId, brandName }: Props) {
  const { hasPermission } = useAdminPermissions();
  const canManage = hasPermission('CONTENT_AUTO_PUBLISH_MANAGE');
  const [status, setStatus] = useState<BrandAutoPublishStatus | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setStatus(null);
    setLoadFailed(false);
    adminContentReviewApi
      .getBrandAutoPublish(brandId)
      .then((response) => {
        if (active) setStatus(unwrapApiResponse(response.data as any) as BrandAutoPublishStatus);
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      });
    return () => {
      active = false;
    };
  }, [brandId]);

  const nextEnabled = !status?.enabled;

  const closeDialog = useCallback(() => {
    if (saving) return;
    setDialogOpen(false);
    setReason('');
    setReasonError(null);
  }, [saving]);

  const submit = useCallback(async () => {
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setReasonError('Add a short reason — it goes in the audit log.');
      return;
    }
    setSaving(true);
    try {
      const response = await adminContentReviewApi.setBrandAutoPublish(brandId, {
        enabled: nextEnabled,
        reason: trimmed,
      });
      setStatus(unwrapApiResponse(response.data as any) as BrandAutoPublishStatus);
      toast.success(
        nextEnabled
          ? 'Auto-publish is on. This brand’s listings now go live without review.'
          : 'Auto-publish is off. This brand’s listings go to review again.',
      );
      setDialogOpen(false);
      setReason('');
      setReasonError(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not change auto-publish.');
    } finally {
      setSaving(false);
    }
  }, [brandId, nextEnabled, reason]);

  const label = loadFailed ? 'Unavailable' : status === null ? 'Loading…' : status.enabled ? 'On' : 'Off';

  return (
    <div className="rounded-lg bg-gray-50 p-3 dark:bg-white/5">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Auto-publish</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p
          className={`text-sm font-semibold ${
            status?.enabled ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'
          }`}
          aria-live="polite"
        >
          {label}
        </p>
        {canManage && status ? (
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="rounded-md border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-700 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/[0.08]"
          >
            {status.enabled ? 'Turn off' : 'Turn on'}
          </button>
        ) : null}
      </div>
      {status?.enabled ? (
        <p className="mt-1 text-xs text-gray-500">Listings skip review.</p>
      ) : null}

      <Modal
        open={dialogOpen}
        onClose={closeDialog}
        title={nextEnabled ? 'Turn on auto-publish' : 'Turn off auto-publish'}
        size="md"
        backdropStyle="light"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {nextEnabled
              ? `New designs and products from ${brandName || 'this brand'} will go live immediately, without content review.`
              : `New designs and products from ${brandName || 'this brand'} will go to content review again before going live.`}
          </p>
          <div>
            <label htmlFor="auto-publish-reason" className="text-sm font-semibold text-gray-900 dark:text-white">
              Reason
            </label>
            <textarea
              id="auto-publish-reason"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setReasonError(null);
              }}
              rows={4}
              maxLength={1000}
              placeholder="Why is this changing? Saved to the audit log."
              aria-invalid={Boolean(reasonError)}
              aria-describedby={reasonError ? 'auto-publish-reason-error' : undefined}
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
            {reasonError ? (
              <p id="auto-publish-reason-error" className="mt-1 text-xs font-semibold text-red-600">
                {reasonError}
              </p>
            ) : null}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeDialog}
              disabled={saving}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/[0.08]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={saving}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : nextEnabled ? 'Turn on' : 'Turn off'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
