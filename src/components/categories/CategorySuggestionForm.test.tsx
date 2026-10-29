import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CategorySuggestionForm } from './CategorySuggestionForm';
import { submitCategorySuggestion } from '@/api/CategoriesSuggestionsApi';

vi.mock('@/api/CategoriesSuggestionsApi', () => ({ submitCategorySuggestion: vi.fn() }));
const submit = vi.mocked(submitCategorySuggestion);
function fill() {
  fireEvent.change(screen.getByLabelText(/Garment category/), { target: { value: 'Dresses & Gowns' } });
  fireEvent.change(screen.getByLabelText(/Garment type/), { target: { value: 'Fit-and-Flare' } });
  fireEvent.change(screen.getByLabelText(/What garments/), { target: { value: 'Everyday dresses with a fitted waist.' } });
}
describe('category and garment type proposal', () => {
  beforeEach(() => vi.clearAllMocks());
  it('requires both names and sends one request despite rapid repeated submits', async () => {
    let complete!: (value: Awaited<ReturnType<typeof submitCategorySuggestion>>) => void;
    submit.mockReturnValueOnce(new Promise(resolve => { complete = resolve; }));
    const selected = vi.fn();
    render(<CategorySuggestionForm onSubmitted={selected} />);
    fill();
    const button = screen.getByRole('button', { name: /Request category and garment type review/ });
    fireEvent.click(button); fireEvent.submit(button.closest('form')!);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith({ name: 'Dresses & Gowns', garmentTypeName: 'Fit-and-Flare', description: 'Everyday dresses with a fitted waist.' });
    const proposal = { id:'proposal-1',name:'Dresses & Gowns',slug:'dresses-and-gowns',garmentTypeName:'Fit-and-Flare',status:'PENDING' as const,proposedByUserId:'owner-1',createdAt:'2026-10-28',updatedAt:'2026-10-28' };
    await act(async () => { complete(proposal); });
    expect(selected).toHaveBeenCalledWith(proposal);
    expect(screen.getByRole('status').textContent).toMatch(/saved drafts stay unpublished/i);
  });
  it('retains the proposal after an unsuccessful save so it can be corrected and retried', async () => {
    submit.mockRejectedValueOnce({ response: { data: { message:'A pending suggestion with this name already exists' } } });
    render(<CategorySuggestionForm />); fill();
    fireEvent.click(screen.getByRole('button', { name: /Request category and garment type review/ }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/already exists/));
    expect((screen.getByLabelText(/Garment category/) as HTMLInputElement).value).toBe('Dresses & Gowns');
    expect((screen.getByLabelText(/Garment type/) as HTMLInputElement).value).toBe('Fit-and-Flare');
  });
});
