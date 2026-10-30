import React, { useId, useRef, useState } from 'react';
import { submitCategorySuggestion, type CategorySuggestionDto } from '@/api/CategoriesSuggestionsApi';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';

export const CategorySuggestionForm: React.FC<{ onSubmitted?: (request: CategorySuggestionDto) => void }> = ({ onSubmitted }) => {
  const inputId = useId();
  const [name, setName] = useState('');
  const [garmentTypeName, setGarmentTypeName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [failed, setFailed] = useState(false);
  const submitting = useRef(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setFeedback('');
    setFailed(false);
    try {
      const request = await submitCategorySuggestion({
        name: name.trim(),
        garmentTypeName: garmentTypeName.trim(),
        description: description.trim(),
      });
      setName('');
      setGarmentTypeName('');
      setDescription('');
      setFeedback('Your category suggestion has been submitted. It will be reviewed by our curation team.');
      onSubmitted?.(request);
    } catch (error) {
      const message = (error as { response?: { data?: { message?: unknown } } }).response?.data?.message;
      setFailed(true);
      setFeedback(typeof message === 'string' ? message : 'We could not save your suggestion. Please check your connection and try again.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor={`${inputId}-category`} className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            Suggested Category *
          </label>
          <Input
            id={`${inputId}-category`}
            aria-required={true}
            required
            inputSize="md"
            minLength={2}
            maxLength={48}
            placeholder="e.g. Resort Kaftans"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={busy}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${inputId}-type`} className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            Suggested Garment Type *
          </label>
          <Input
            id={`${inputId}-type`}
            aria-required={true}
            required
            inputSize="md"
            minLength={2}
            maxLength={48}
            placeholder="e.g. Batwing Kaftan"
            value={garmentTypeName}
            onChange={(event) => setGarmentTypeName(event.target.value)}
            disabled={busy}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${inputId}-description`} className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          Cultural Context / Garments Belonging Here *
        </label>
        <Textarea
          id={`${inputId}-description`}
          aria-required={true}
          required
          maxLength={500}
          rows={2}
          placeholder="Briefly describe what garments belong in this category (e.g. Traditional handwoven styles for celebrations)..."
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={busy}
          className="text-xs"
        />
      </div>
      <p className="text-[11px] text-[var(--text-muted)]">
        Tip: Suggest a garment family rather than an occasion. Up to 5 suggestions can be submitted per day.
      </p>
      <Button
        type="submit"
        variant="brand"
        loading={busy}
        disabled={busy || !name.trim() || !garmentTypeName.trim() || !description.trim()}
        className="text-xs py-2 px-4 rounded-xl"
      >
        {busy ? 'Submitting suggestion…' : 'Submit Category Suggestion'}
      </Button>
      {feedback ? (
        <p
          role={failed ? 'alert' : 'status'}
          className={`text-xs p-2.5 rounded-xl ${
            failed
              ? 'text-rose-300 bg-rose-500/10 border border-rose-500/20'
              : 'text-purple-200 bg-purple-500/10 border border-purple-500/20'
          }`}
        >
          {feedback}
        </p>
      ) : null}
    </form>
  );
};
