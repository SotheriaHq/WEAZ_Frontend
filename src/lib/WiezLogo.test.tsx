import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WiezLogo from './WiezLogo';
import { COMPANY_LOGO_PATH, COMPANY_NAME } from './brand';

vi.mock('@/components/media/MediaRenderer', () => ({
  default: ({
    src,
    alt,
    kind,
  }: {
    src: string;
    alt: string;
    kind: string;
  }) => (
    <div
      data-testid="logo-media"
      data-kind={kind}
      data-src={src}
      aria-label={alt}
    />
  ),
}));

describe('WiezLogo', () => {
  it('renders through the approved media renderer', () => {
    render(<WiezLogo decorative={false} />);

    const logo = screen.getByTestId('logo-media');
    expect(logo).toHaveAttribute('data-kind', 'image');
    expect(logo).toHaveAttribute('data-src', COMPANY_LOGO_PATH);
    expect(logo).toHaveAttribute('aria-label', `${COMPANY_NAME} logo`);
  });
});
