import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AvatarCard from './AvatarCard';

vi.mock('../ImageWithFallback', () => ({
  default: (props: {
    src?: string | null;
    fileId?: string | null;
    maxHeightClassName?: string;
    fallbackName?: string;
  }) => (
    <div
      data-testid="avatar-image"
      data-src={props.src ?? ''}
      data-file-id={props.fileId ?? ''}
      data-max-height={props.maxHeightClassName ?? ''}
      data-fallback-name={props.fallbackName ?? ''}
    />
  ),
}));

describe('AvatarCard', () => {
  it('uses the rounded-square fallback avatar when no image source exists', () => {
    render(<AvatarCard name="Threadly Atelier" alt="Threadly Atelier" />);

    expect(screen.getByLabelText('Threadly Atelier avatar')).toBeInTheDocument();
    expect(screen.queryByTestId('avatar-image')).not.toBeInTheDocument();
  });

  it('passes fileId and full-height constraints to the avatar image renderer', () => {
    render(
      <AvatarCard
        src={null}
        fileId="file_avatar_123"
        name="Threadly Atelier"
        size="lg"
      />,
    );

    const image = screen.getByTestId('avatar-image');
    expect(image).toHaveAttribute('data-file-id', 'file_avatar_123');
    expect(image).toHaveAttribute('data-max-height', 'max-h-full');
    expect(image).not.toHaveAttribute('data-max-height', 'max-h-28');
  });
});
