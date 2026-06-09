import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProfileContentLoadingFallback } from './ProfileLayout';

describe('ProfileContentLoadingFallback', () => {
  it('shows a brand setup loading state instead of a blank route surface', () => {
    render(<ProfileContentLoadingFallback brandSetupPrompt />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Preparing brand setup...')).toBeInTheDocument();
    expect(
      screen.getByText('Your profile is loading. The setup form will open automatically.'),
    ).toBeInTheDocument();
  });
});
