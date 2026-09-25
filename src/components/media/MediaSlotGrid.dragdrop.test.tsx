/**
 * Drop routing for the slot grid.
 *
 * The bug these cover shipped twice. Dragging a tile puts an `<img>` on the
 * drag and Chromium attaches a re-encoded copy of it to `dataTransfer.files`,
 * so the grid — which decided by payload and checked `files` first — treated
 * every internal reorder as an external photo drop. Design creation duplicated
 * the dragged image; product creation deleted the target slot's image to make
 * room, then hit the six-image cap and uploaded nothing, so the image was
 * simply gone.
 *
 * The rule now under test: a drag that STARTED on one of our tiles is a
 * reorder, whatever the browser attached to it.
 */
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import MediaSlotGrid, { type MediaSlotGridItem } from './MediaSlotGrid';
import type { MediaViewSlot } from '@/utils/contentIntegrity';

const SLOT_DRAG_MIME = 'application/x-wiez-media-slot';

const imageFile = () => new File(['x'], 'image.png', { type: 'image/png' });

/** Minimal stand-in for `DataTransfer`, which jsdom does not implement. */
const makeDataTransfer = (files: File[] = []) => {
  const data: Record<string, string> = {};
  return {
    files,
    get types() {
      return Object.keys(data);
    },
    getData: (type: string) => data[type] ?? '',
    setData: (type: string, value: string) => {
      data[type] = value;
    },
    effectAllowed: 'none',
    dropEffect: 'none',
  };
};

const mediaBySlot = new Map<MediaViewSlot, MediaSlotGridItem>([
  ['FRONT', { id: 'front-1', url: 'https://cdn.test/front.jpg', kind: 'image' }],
  ['BACK', { id: 'back-1', url: 'https://cdn.test/back.jpg', kind: 'image' }],
]);

const renderGrid = (
  overrides: Partial<React.ComponentProps<typeof MediaSlotGrid>> = {},
) => {
  const onSlotDrop = vi.fn();
  const onDropFiles = vi.fn();
  const onPickForSlot = vi.fn();

  const { container } = render(
    <MediaSlotGrid
      mediaBySlot={mediaBySlot}
      onPickForSlot={onPickForSlot}
      onSlotDrop={onSlotDrop}
      onDropFiles={onDropFiles}
      {...overrides}
    />,
  );

  const tile = (slot: string) =>
    container.querySelector(`[data-slot="${slot}"]`) as HTMLElement;

  return { onSlotDrop, onDropFiles, tile };
};

describe('MediaSlotGrid drop routing', () => {
  it('reorders when the drag started on a tile, even though the browser attached a file', () => {
    const { onSlotDrop, onDropFiles, tile } = renderGrid();
    const dataTransfer = makeDataTransfer([imageFile()]);

    fireEvent.dragStart(tile('FRONT'), { dataTransfer });
    fireEvent.drop(tile('BACK'), { dataTransfer });

    expect(onSlotDrop).toHaveBeenCalledWith('FRONT', 'BACK');
    expect(onDropFiles).not.toHaveBeenCalled();
  });

  it('records the source slot under a type the browser cannot forge', () => {
    const { tile } = renderGrid();
    const dataTransfer = makeDataTransfer();

    fireEvent.dragStart(tile('FRONT'), { dataTransfer });

    expect(dataTransfer.getData(SLOT_DRAG_MIME)).toBe('FRONT');
  });

  it('still uploads a genuine external file drop', () => {
    const { onSlotDrop, onDropFiles, tile } = renderGrid();
    const file = imageFile();

    fireEvent.drop(tile('LEFT_SIDE'), { dataTransfer: makeDataTransfer([file]) });

    expect(onDropFiles).toHaveBeenCalledWith('LEFT_SIDE', [file]);
    expect(onSlotDrop).not.toHaveBeenCalled();
  });

  it('ignores a drop onto the slot the drag started from', () => {
    const { onSlotDrop, onDropFiles, tile } = renderGrid();
    const dataTransfer = makeDataTransfer([imageFile()]);

    fireEvent.dragStart(tile('FRONT'), { dataTransfer });
    fireEvent.drop(tile('FRONT'), { dataTransfer });

    expect(onSlotDrop).not.toHaveBeenCalled();
    expect(onDropFiles).not.toHaveBeenCalled();
  });

  it('does not reorder after the drag is abandoned', () => {
    const { onSlotDrop, onDropFiles, tile } = renderGrid();

    fireEvent.dragStart(tile('FRONT'), { dataTransfer: makeDataTransfer() });
    fireEvent.dragEnd(tile('FRONT'));

    // A fresh transfer carries no source slot, so this is an external drop.
    const file = imageFile();
    fireEvent.drop(tile('BACK'), { dataTransfer: makeDataTransfer([file]) });

    expect(onSlotDrop).not.toHaveBeenCalled();
    expect(onDropFiles).toHaveBeenCalledWith('BACK', [file]);
  });

  it('does not route drops at all while disabled', () => {
    const { onSlotDrop, onDropFiles, tile } = renderGrid({ disabled: true });
    const dataTransfer = makeDataTransfer([imageFile()]);

    fireEvent.dragStart(tile('FRONT'), { dataTransfer });
    fireEvent.drop(tile('BACK'), { dataTransfer });

    expect(onSlotDrop).not.toHaveBeenCalled();
    expect(onDropFiles).not.toHaveBeenCalled();
  });
});
