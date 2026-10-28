import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ConfirmDialog from './ConfirmDialog';
import SearchField from '@/components/SearchField';
import Tabs from '@/components/Tabs';
import SegmentChips from './SegmentChips';
import EmptyState from '@/components/EmptyState';

describe('Wave 3 Composite UI Components', () => {
  describe('ConfirmDialog', () => {
    it('composes canonical Button with secondary cancel and primary/danger confirm', () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();

      render(
        <ConfirmDialog
          open={true}
          title="Delete Item"
          message="Are you sure you want to delete this item?"
          confirmText="Delete"
          cancelText="Keep"
          isDestructive={true}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Delete Item')).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to delete this item?')).toBeInTheDocument();

      const cancelBtn = screen.getByRole('button', { name: 'Keep' });
      expect(cancelBtn).toHaveClass('neu-pressed-button');

      const confirmBtn = screen.getByRole('button', { name: 'Delete' });
      expect(confirmBtn.className).toContain('var(--wiez-action-danger)');

      fireEvent.click(cancelBtn);
      expect(onCancel).toHaveBeenCalledTimes(1);

      fireEvent.click(confirmBtn);
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe('SearchField', () => {
    it('renders expanded search field with role="combobox" and clear button', () => {
      const onSearch = vi.fn();

      render(
        <SearchField
          collapsible={false}
          value="Adire"
          onSearch={onSearch}
          placeholder="Search collections..."
        />
      );

      const input = screen.getByRole('combobox');
      expect(input).toHaveValue('Adire');
      expect(input).toHaveClass('wiez-search-input');

      const clearBtn = screen.getByRole('button', { name: /clear search/i });
      expect(clearBtn).toBeInTheDocument();

      fireEvent.mouseDown(clearBtn);
      expect(onSearch).toHaveBeenCalledWith('');
    });
  });

  describe('Tabs', () => {
    it('renders tabstrip with proper accessibility roles and active selection', () => {
      const onTabChange = vi.fn();

      render(
        <Tabs
          tabs={['designs', 'collections', 'products']}
          labels={{ designs: 'Designs', collections: 'Collections', products: 'Products' }}
          activeTab="designs"
          onTabChange={onTabChange}
        />
      );

      expect(screen.getByRole('tablist')).toBeInTheDocument();

      const activeTab = screen.getByRole('tab', { name: 'Designs' });
      expect(activeTab).toHaveAttribute('aria-selected', 'true');

      const inactiveTab = screen.getByRole('tab', { name: 'Collections' });
      expect(inactiveTab).toHaveAttribute('aria-selected', 'false');

      fireEvent.click(inactiveTab);
      expect(onTabChange).toHaveBeenCalledWith('collections');
    });
  });

  describe('SegmentChips', () => {
    it('renders segmented chip options and uses neu-pressed-button for active option', () => {
      const onChange = vi.fn();

      render(
        <SegmentChips
          options={[
            { key: 'all', label: 'All' },
            { key: 'live', label: 'Live' },
            { key: 'draft', label: 'Draft' },
          ]}
          value="live"
          onChange={onChange}
        />
      );

      const activeChip = screen.getByRole('tab', { name: 'Live' });
      expect(activeChip).toHaveAttribute('aria-selected', 'true');
      expect(activeChip).toHaveClass('neu-pressed-button');

      const draftChip = screen.getByRole('tab', { name: 'Draft' });
      expect(draftChip).toHaveAttribute('aria-selected', 'false');

      fireEvent.click(draftChip);
      expect(onChange).toHaveBeenCalledWith('draft');
    });
  });

  describe('EmptyState', () => {
    it('renders title, description and icon container', () => {
      render(
        <EmptyState
          icon={<span data-testid="empty-icon">🎨</span>}
          title="No designs found"
          description="Create your first design to get started."
          cta={<button>Create design</button>}
        />
      );

      expect(screen.getByText('No designs found')).toBeInTheDocument();
      expect(screen.getByText('Create your first design to get started.')).toBeInTheDocument();
      expect(screen.getByTestId('empty-icon')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create design' })).toBeInTheDocument();
    });
  });
});
