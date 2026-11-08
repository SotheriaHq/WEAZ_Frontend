import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TagPicker from './TagPicker';

describe('TagPicker Accessibility & Validation', () => {
  it('renders input with default accessible attributes and no error alert', () => {
    const onChange = vi.fn();
    render(<TagPicker suggestions={['denim', 'summer']} value={[]} onChange={onChange} />);

    const input = screen.getByLabelText('Add or search tags');
    expect(input).toBeDefined();
    expect(input.getAttribute('aria-invalid')).toBe('false');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders role="alert" and aria-live="assertive" on invalid tag format and preserves invalid input', () => {
    const onChange = vi.fn();
    render(<TagPicker suggestions={[]} value={[]} onChange={onChange} />);

    const input = screen.getByLabelText('Add or search tags') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'a' } }); // < MIN_LENGTH (2)
    
    const addButton = screen.getByRole('button', { name: 'Add' });
    fireEvent.click(addButton);

    // role="alert" must be present
    const alert = screen.getByRole('alert');
    expect(alert).toBeDefined();
    expect(alert.getAttribute('aria-live')).toBe('assertive');
    expect(alert.textContent).toContain('Tag must be at least 2 characters');

    // Input aria-invalid must be true and linked via aria-describedby
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('tag-picker-error');

    // Input text must be PRESERVED so user can correct it
    expect(input.value).toBe('a');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clears error alert when user modifies input', () => {
    const onChange = vi.fn();
    render(<TagPicker suggestions={[]} value={[]} onChange={onChange} />);

    const input = screen.getByLabelText('Add or search tags') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByRole('alert')).toBeDefined();

    // User types new character
    fireEvent.change(input, { target: { value: 'denim' } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(input.getAttribute('aria-invalid')).toBe('false');
  });

  it('handles duplicate tags with role="alert" and preserves query', () => {
    const onChange = vi.fn();
    render(<TagPicker suggestions={[]} value={['vintage']} onChange={onChange} />);

    const input = screen.getByLabelText('Add or search tags') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'vintage' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain("Tag '#vintage' already added");
    expect(input.value).toBe('vintage');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('submits on Enter key and adds valid tag', () => {
    const onChange = vi.fn();
    render(<TagPicker suggestions={[]} value={[]} onChange={onChange} />);

    const input = screen.getByLabelText('Add or search tags') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'streetwear' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(['streetwear']);
    expect(input.value).toBe('');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
