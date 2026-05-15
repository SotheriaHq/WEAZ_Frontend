import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import UniversalSelect from './UniversalSelect';

const cityOptions = [
  'Agege',
  'Ajeromi-Ifelodun',
  'Alimosho',
  'Amuwo-Odofin',
  'Apapa',
  'Badagry',
  'Epe',
  'Eti-Osa',
  'Ikeja',
  'Ikorodu',
].map((label) => ({ value: label.toLowerCase().replace(/\s+/g, '-'), label }));

describe('UniversalSelect', () => {
  it('keeps searchable dropdowns scrollable with one stable surface border', () => {
    render(
      <UniversalSelect
        label="City"
        value=""
        onChange={vi.fn()}
        options={cityOptions}
        placeholder="City"
        searchable
        searchPlaceholder="Search cities..."
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'City' }));

    const listbox = screen.getByRole('listbox', { name: 'City' });
    expect(listbox.className).toContain('overflow-y-auto');
    expect(listbox.className).toContain('overscroll-contain');

    const dropdown = listbox.parentElement;
    expect(dropdown?.className).toContain('border-[color:var(--border-default)]');
    expect(dropdown?.className).toContain('focus-within:border-[color:var(--border-strong)]');

    const searchInput = screen.getByPlaceholderText('Search cities...');
    expect(searchInput.className).not.toContain('border ');
    expect(searchInput.className).toContain('focus:ring-2');

    fireEvent.change(searchInput, { target: { value: 'ike' } });

    expect(screen.getByRole('option', { name: 'Ikeja' })).toBeTruthy();
    expect(dropdown?.className).toContain('border-[color:var(--border-default)]');
  });
});
