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
    submitting.current = true; setBusy(true); setFeedback(''); setFailed(false);
    try {
      const request = await submitCategorySuggestion({ name: name.trim(), garmentTypeName: garmentTypeName.trim(), description: description.trim() });
      setName(''); setGarmentTypeName(''); setDescription('');
      setFeedback('Category and garment type sent for review. Your design has its own approval; saved drafts stay unpublished.');
      onSubmitted?.(request);
    } catch (error) {
      const message = (error as { response?: { data?: { message?: unknown } } }).response?.data?.message;
      setFailed(true);
      setFeedback(typeof message === 'string' ? message : 'The request could not be saved. Your entries are retained; try again.');
    } finally { submitting.current = false; setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label htmlFor={`${inputId}-category`} className="text-sm font-semibold">Garment category</label>
          <Input id={`${inputId}-category`} aria-required={true} required inputSize="lg" minLength={2} maxLength={48} value={name}
            onChange={(event) => setName(event.target.value)} disabled={busy} style={{borderWidth:2}} />
        </div>
        <div className="space-y-2">
          <label htmlFor={`${inputId}-type`} className="text-sm font-semibold">Garment type</label>
          <Input id={`${inputId}-type`} aria-required={true} required inputSize="lg" minLength={2} maxLength={48} value={garmentTypeName}
            onChange={(event) => setGarmentTypeName(event.target.value)} disabled={busy} style={{borderWidth:2}} />
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor={`${inputId}-description`} className="text-sm font-semibold">What garments belong in this category?</label>
        <Textarea id={`${inputId}-description`} aria-required={true} required maxLength={500} value={description}
          onChange={(event) => setDescription(event.target.value)} disabled={busy} style={{borderWidth:2,fontSize:'1rem'}} />
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300">Use a garment family, rather than an audience, occasion, fabric or style. You can submit up to five requests per day.</p>
      <Button type="submit" variant="brand" loading={busy} disabled={busy || !name.trim() || !garmentTypeName.trim() || !description.trim()}>
        {busy ? 'Saving request…' : 'Request category and garment type review'}
      </Button>
      {feedback ? <p role={failed ? 'alert' : 'status'} className="text-sm leading-6">{feedback}</p> : null}
    </form>
  );
};
