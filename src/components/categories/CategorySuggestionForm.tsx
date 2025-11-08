import React, { useState } from 'react';
import { submitCategorySuggestion } from '../../api/CategoriesSuggestionsApi';

interface Props {
  onSubmitted?: () => void;
}

export const CategorySuggestionForm: React.FC<Props> = ({ onSubmitted }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canSubmit = name.trim().length >= 2 && name.trim().length <= 48 && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await submitCategorySuggestion({ name: name.trim(), description: description.trim() || undefined });
      setSuccess('Suggestion submitted');
      setName('');
      setDescription('');
      onSubmitted?.();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to submit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 rounded bg-white/60 backdrop-blur shadow">
      <h3 className="text-lg font-semibold">Suggest a new Category</h3>
      <div>
        <label className="block text-sm font-medium">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded border px-2 py-1"
          placeholder="e.g. Sustainable Fashion"
          maxLength={48}
          required
        />
        <p className="text-xs text-gray-500 mt-1">2-48 alphanumeric & spaces.</p>
      </div>
      <div>
        <label className="block text-sm font-medium">Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full rounded border px-2 py-1 resize-y"
          rows={3}
          maxLength={500}
          placeholder="Brief description of why this category is needed"
        />
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      {success && <div className="text-sm text-green-600">{success}</div>}
      <button
        type="submit"
        disabled={!canSubmit}
        className="rounded px-4 py-2 bg-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? 'Submitting...' : 'Submit Suggestion'}
      </button>
    </form>
  );
};
