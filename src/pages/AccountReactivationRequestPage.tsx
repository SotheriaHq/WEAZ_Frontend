import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient } from '@/api/httpClient';
import { toast } from 'sonner';

const AccountReactivationRequestPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiClient.post('/auth/account-reactivation/request', {
        email: email.trim(),
        reason: reason.trim(),
      });
      toast.success('Reactivation request submitted');
      setReason('');
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || 'Failed to submit reactivation request',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--surface-primary)] text-[var(--text-primary)] flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 sm:p-8 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">🧾 Account Reactivation Request</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            If your account is suspended or deactivated, submit a leniency request for admin review.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Reason for leniency/reactivation</label>
            <textarea
              required
              minLength={15}
              maxLength={1200}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={6}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm"
              placeholder="Explain why your account should be reactivated..."
            />
            <p className="text-xs text-gray-500">{reason.length}/1200</p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-primary text-white py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
          >
            {submitting ? 'Submitting...' : 'Submit Reactivation Request'}
          </button>
        </form>

        <p className="text-sm text-gray-500">
          <Link to="/login" className="text-primary hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default AccountReactivationRequestPage;
