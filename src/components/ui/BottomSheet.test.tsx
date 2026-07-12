import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import BottomSheet, { type SheetState } from './BottomSheet';

const Harness = ({ onChange }: { onChange?: (s: SheetState) => void }) => {
  const [state, setState] = useState<SheetState>('half');
  return (
    <BottomSheet
      open
      state={state}
      onStateChange={(next) => {
        setState(next);
        onChange?.(next);
      }}
      peek={<div>PEEK ROW</div>}
    >
      <div>SHEET BODY</div>
    </BottomSheet>
  );
};

describe('BottomSheet', () => {
  afterEach(cleanup);

  it('renders the peek row and body content', () => {
    render(<Harness />);
    expect(screen.getByText('PEEK ROW')).toBeTruthy();
    expect(screen.getByText('SHEET BODY')).toBeTruthy();
  });

  it('cycles the snap state forward on a tap (no drag movement)', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const handle = screen.getByText('PEEK ROW').parentElement as HTMLElement;

    // A pointer down + up at the same position is a tap: half -> full.
    fireEvent.pointerDown(handle, { pointerId: 1, clientY: 400 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientY: 400 });

    expect(onChange).toHaveBeenCalledWith('full');
  });
});
