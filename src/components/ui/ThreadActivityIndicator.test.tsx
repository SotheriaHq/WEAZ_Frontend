import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ThreadActivityIndicator from './ThreadActivityIndicator';

describe('ThreadActivityIndicator', () => {
  it('renders the native-aligned thread spool without the old needle glyph', () => {
    render(<ThreadActivityIndicator active state="adding" size={24} />);

    const indicator = screen.getByTestId('thread-activity-indicator');
    expect(indicator).toHaveTextContent(String.fromCodePoint(0x1f9f5));
    expect(indicator).not.toHaveTextContent(String.fromCodePoint(129697));
    expect(indicator).toHaveAttribute('aria-hidden', 'true');
    expect(indicator).toHaveAttribute('data-active', 'true');
  });
});
