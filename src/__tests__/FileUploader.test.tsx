import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FileUploader from '../components/upload/FileUploader';

const createFileList = (files: File[]): FileList => {
  const fileList: Partial<FileList> = {
    length: files.length,
    item: (index: number) => files[index] ?? null,
  };

  files.forEach((file, index) => {
    (fileList as Record<number, File>)[index] = file;
  });

  return fileList as FileList;
};

describe('FileUploader', () => {
  it('invokes onFilesUpload when selecting supported files', () => {
    const handleFiles = vi.fn();
    const { container } = render(<FileUploader onFilesUpload={handleFiles} accept={['image/']} />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['file-content'], 'photo.png', { type: 'image/png' });

    fireEvent.change(input, { target: { files: createFileList([file]) } });

    expect(handleFiles).toHaveBeenCalledTimes(1);
    expect(handleFiles).toHaveBeenCalledWith([file]);
  });

  it('applies highlight styles during drag interactions', () => {
    const { container } = render(<FileUploader onFilesUpload={() => {}} variant="small" />);
    const surface = container.firstElementChild as HTMLElement;

    expect(surface.className).toContain('border-gray-200');

    fireEvent.dragOver(surface);
    expect(surface.className).toContain('border-blue-500');

    fireEvent.dragLeave(surface);
    expect(surface.className).not.toContain('border-blue-500');
  });

  it('blocks interactions when disabled', () => {
    const handleFiles = vi.fn();
    const { container } = render(<FileUploader onFilesUpload={handleFiles} disabled />);
    const surface = container.firstElementChild as HTMLElement;
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['file-content'], 'photo.png', { type: 'image/png' });

    expect(surface.className).toContain('pointer-events-none');

    fireEvent.change(input, { target: { files: createFileList([file]) } });
    expect(handleFiles).not.toHaveBeenCalled();
  });
});
