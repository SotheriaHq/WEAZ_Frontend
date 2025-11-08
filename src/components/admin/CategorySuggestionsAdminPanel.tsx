import React, { useEffect, useState } from 'react';
import { adminListCategorySuggestions, adminModerateCategorySuggestion } from '../../api/CategoriesSuggestionsApi';
import type { CategorySuggestionDto, CategorySuggestionStatus } from '../../api/CategoriesSuggestionsApi';

export const CategorySuggestionsAdminPanel: React.FC = () => {
  const [status, setStatus] = useState<CategorySuggestionStatus | ''>('');
  const [rows, setRows] = useState<CategorySuggestionDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminListCategorySuggestions(status || undefined);
      setRows(data ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [status]);

  const moderate = async (id: string, decision: 'APPROVE' | 'REJECT') => {
    const reason = decision === 'REJECT' ? prompt('Rejection reason (optional)') ?? undefined : undefined;
    try {
      await adminModerateCategorySuggestion(id, decision, reason);
      await load();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to moderate');
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-lg font-semibold">Category Suggestions</h3>
        <select className="border rounded px-2 py-1" value={status}
          onChange={(e) => setStatus((e.target.value as CategorySuggestionStatus | '') )}>
          <option value="">All</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <button className="px-3 py-1 rounded border" onClick={load}>Refresh</button>
      </div>
      {loading && <div>Loading…</div>}
      {error && <div className="text-red-600">{error}</div>}
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="p-3 rounded border bg-white/60 backdrop-blur">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium">{r.name} <span className="text-xs text-gray-500">/{r.slug}</span></div>
                {r.description && <div className="text-sm text-gray-700 mt-1">{r.description}</div>}
                <div className="text-xs text-gray-500 mt-1">By {r.proposedByUserId} • {new Date(r.createdAt).toLocaleString()} • Status: {r.status}</div>
                {r.rejectionReason && <div className="text-xs text-gray-500">Reason: {r.rejectionReason}</div>}
              </div>
              {r.status === 'PENDING' && (
                <div className="flex gap-2">
                  <button className="px-3 py-1 rounded bg-green-600 text-white" onClick={() => moderate(r.id, 'APPROVE')}>Approve</button>
                  <button className="px-3 py-1 rounded bg-red-600 text-white" onClick={() => moderate(r.id, 'REJECT')}>Reject</button>
                </div>
              )}
            </div>
          </div>
        ))}
        {(!loading && rows.length === 0) && <div className="text-sm text-gray-600">No suggestions</div>}
      </div>
    </div>
  );
};
