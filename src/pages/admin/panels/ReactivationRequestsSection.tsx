import React, { useCallback, useEffect, useRef, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { adminUsersApi } from '@/api/AdminApi';
import type { AdminReactivationRequest } from '@/types/admin';
import { unwrapApiResponse } from '@/types/auth';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';

/**
 * Pending account-reactivation requests (suspended/deactivated users asking to
 * return). Ported verbatim from the old AdminUsersPage so the unified console
 * keeps this lifecycle surface. Gated on USERS_DEACTIVATE.
 */

function normalizeUiError(error: unknown): string {
  const err = error as any;
  if (err?.response?.status === 429) return 'Too many requests. Wait a moment and try again.';
  const msg = err?.response?.data?.message;
  if (typeof msg === 'string' && msg.trim()) return msg;
  return 'Request failed';
}

const ReactivationRequestsSection: React.FC = () => {
  const { hasPermission } = useAdminPermissions();
  const canReadUsers = hasPermission('USERS_READ');
  const [requests, setRequests] = useState<AdminReactivationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null);
  const [reviewPrompt, setReviewPrompt] = useState<{
    request: AdminReactivationRequest;
    decision: 'APPROVE' | 'REJECT';
    note: string;
  } | null>(null);
  const inFlightRef = useRef(false);

  const fetchRequests = useCallback(async () => {
    if (!canReadUsers) {
      setRequests([]);
      setLoading(false);
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    try {
      const res = await adminUsersApi.listReactivationRequests({ status: 'PENDING', limit: '25' });
      const payload = unwrapApiResponse<{ items?: AdminReactivationRequest[] } | AdminReactivationRequest[]>(res.data as any);
      setRequests(Array.isArray(payload) ? payload : payload.items ?? []);
    } catch (err) {
      setError(normalizeUiError(err));
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [canReadUsers]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  const openReviewPrompt = useCallback((request: AdminReactivationRequest, decision: 'APPROVE' | 'REJECT') => {
    setReviewPrompt({
      request,
      decision,
      note: decision === 'APPROVE' ? 'Approved after account review' : 'Rejected after account review',
    });
  }, []);

  const executeReview = useCallback(async () => {
    if (!reviewPrompt) return;
    const { request, decision, note } = reviewPrompt;
    setReviewPrompt(null);
    setReviewingRequestId(request.id);
    setError(null);
    try {
      await adminUsersApi.reviewReactivationRequest(request.id, { decision, adminNote: note || undefined });
      await fetchRequests();
    } catch (err) {
      setError(normalizeUiError(err));
    } finally {
      setReviewingRequestId(null);
    }
  }, [reviewPrompt, fetchRequests]);

  if (!hasPermission('USERS_DEACTIVATE')) return null;

  return (
    <section className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Reactivation Requests
          {requests.length > 0 && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">{requests.length}</span>
          )}
        </h2>
        <button type="button" onClick={() => void fetchRequests()} className="rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-400 dark:hover:bg-white/5">Refresh</button>
      </div>

      {error && <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">{error}</div>}

      {loading ? (
        <p className="py-4 text-sm text-gray-400 dark:text-gray-500">Loading...</p>
      ) : requests.length === 0 ? (
        <p className="py-4 text-sm text-gray-400 dark:text-gray-500">No pending reactivation requests.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left dark:border-white/5">
                <th className="pb-2 pr-3 text-xs font-semibold text-gray-400 dark:text-gray-500">Email</th>
                <th className="pb-2 pr-3 text-xs font-semibold text-gray-400 dark:text-gray-500">Reason</th>
                <th className="pb-2 pr-3 text-xs font-semibold text-gray-400 dark:text-gray-500">Requested</th>
                <th className="pb-2 text-xs font-semibold text-gray-400 dark:text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id} className="border-b border-gray-50 dark:border-white/5">
                  <td className="py-2.5 pr-3 text-gray-700 dark:text-gray-200">{req.emailSnapshot}</td>
                  <td className="py-2.5 pr-3 text-gray-500 dark:text-gray-400"><p className="line-clamp-2 max-w-[360px]">{req.reason}</p></td>
                  <td className="py-2.5 pr-3 text-xs text-gray-400 dark:text-gray-500">{new Date(req.createdAt).toLocaleString()}</td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openReviewPrompt(req, 'APPROVE')} disabled={reviewingRequestId === req.id} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">Approve</button>
                      <button onClick={() => openReviewPrompt(req, 'REJECT')} disabled={reviewingRequestId === req.id} className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-rose-700 disabled:opacity-60">Reject</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!reviewPrompt} onClose={() => setReviewPrompt(null)} title={reviewPrompt?.decision === 'APPROVE' ? 'Approve Request' : 'Reject Request'} size="sm">
        {reviewPrompt && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {reviewPrompt.decision === 'APPROVE' ? 'Approve' : 'Reject'} reactivation for <strong>{reviewPrompt.request.emailSnapshot}</strong>?
            </p>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">Admin Note (optional)</label>
              <textarea value={reviewPrompt.note} onChange={(e) => setReviewPrompt((prev) => (prev ? { ...prev, note: e.target.value } : null))} rows={3} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-black/20 dark:text-white" placeholder="Add a note..." />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setReviewPrompt(null)} className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/10">Cancel</button>
              <button type="button" onClick={() => void executeReview()} className={`rounded-xl px-4 py-2 text-xs font-semibold text-white ${reviewPrompt.decision === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>{reviewPrompt.decision === 'APPROVE' ? 'Approve' : 'Reject'}</button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
};

export default ReactivationRequestsSection;
