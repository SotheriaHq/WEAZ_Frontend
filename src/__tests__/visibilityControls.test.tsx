import { describe, it, expect } from 'vitest';
import { render, fireEvent, act, getAllByRole } from '@testing-library/react';
import AddCollectionModal from '../components/profile/AddCollectionModal';

// Minimal mock for upload hook used inside modal
vi.mock('../hooks/useCollectionUpload', () => ({
  useCollectionUpload: () => ({ uploadCollection: async () => ({ id: 'x' }), isUploading: false, progress: 0 })
}));
vi.mock('../api/BrandApi', () => ({ brandApi: { getCategories: async () => [{ id: 'cat1', slug: 'c1', name: 'Cat 1' }] } }));

describe('AddCollectionModal visibility controls', () => {
  it('shows cooldown note when Private selected', async () => {
    const { container, getByText } = render(<AddCollectionModal isOpen={true} onClose={() => {}} onCreate={() => {}} />);

    const selects = getAllByRole(container, 'combobox');
    const visibilitySelect = selects[1];

    await act(async () => {
      fireEvent.change(visibilitySelect, { target: { value: 'private' } });
    });

    expect(getByText(/wait 72 hours/i)).toBeTruthy();
  });
});
