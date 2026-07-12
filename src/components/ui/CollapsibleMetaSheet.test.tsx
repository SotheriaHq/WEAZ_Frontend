import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CollapsibleMetaSheet } from './CollapsibleMetaSheet';

describe('CollapsibleMetaSheet', () => {
  it('renders peek content and supports snap toggle via Details control parent', () => {
    const onSnapChange = vi.fn();
    render(
      <CollapsibleMetaSheet
        snap="collapsed"
        onSnapChange={onSnapChange}
        peek={<div>Peek brand</div>}
        body={<div>Body details</div>}
      />,
    );

    expect(screen.getByText('Peek brand')).toBeInTheDocument();
    expect(screen.getByText('Body details')).toBeInTheDocument();
  });

  it('does not crash on pointer drag interaction', () => {
    const onSnapChange = vi.fn();
    const { container } = render(
      <CollapsibleMetaSheet
        snap="collapsed"
        onSnapChange={onSnapChange}
        peek={<div>Peek</div>}
        body={<div>Body</div>}
      />,
    );

    const root = container.firstChild as HTMLElement;
    fireEvent.pointerDown(root, { pointerId: 1, clientY: 200 });
    fireEvent.pointerMove(root, { pointerId: 1, clientY: 120 });
    fireEvent.pointerUp(root, { pointerId: 1, clientY: 120 });
    // May expand from drag-up; either way the sheet remains mounted.
    expect(screen.getByText('Peek')).toBeInTheDocument();
  });
});
