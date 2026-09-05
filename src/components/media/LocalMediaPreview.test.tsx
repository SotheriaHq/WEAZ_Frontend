import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LocalMediaPreview from './LocalMediaPreview';

const sniffImageFormatMock = vi.hoisted(() => vi.fn());
const probeImagePreviewUrlMock = vi.hoisted(() => vi.fn());
const uploadPreviewImageMock = vi.hoisted(() => vi.fn());
const addClientDiagnosticMock = vi.hoisted(() => vi.fn());

vi.mock('@/utils/imageByteSniff', () => ({
  sniffImageFormat: sniffImageFormatMock,
  isBrowserDisplayableSniff: (format: string) => format === 'jpeg',
  isUnreadableSniff: () => false,
}));

vi.mock('@/utils/imagePreview', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/imagePreview')>();
  return {
    ...actual,
    probeImagePreviewUrl: probeImagePreviewUrlMock,
  };
});

vi.mock('@/api/UploadApi', () => ({
  uploadPreviewImage: uploadPreviewImageMock,
}));

vi.mock('@/utils/clientDiagnostics', () => ({
  addClientDiagnostic: addClientDiagnosticMock,
}));

vi.mock('./MediaRenderer', () => ({
  default: ({
    src,
    alt,
    onError,
  }: {
    src: string;
    alt?: string;
    onError?: () => void;
  }) => (
    <img
      data-testid="rendered-media"
      src={src}
      alt={alt ?? ''}
      onError={onError}
    />
  ),
}));

describe('LocalMediaPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sniffImageFormatMock.mockResolvedValue('jpeg');
    probeImagePreviewUrlMock.mockResolvedValue(undefined);
    uploadPreviewImageMock.mockResolvedValue('blob:server-preview');
  });

  it('renders a trusted blob preview immediately without re-probing or server fallback', async () => {
    const file = new File(['bytes'], 'photo.jpg', { type: 'image/jpeg' });

    render(
      <LocalMediaPreview
        kind="image"
        src="blob:trusted-preview"
        file={file}
        alt="Front"
        diagnosticScope="test-preview"
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('rendered-media')).toHaveAttribute(
        'src',
        'blob:trusted-preview',
      );
    });

    expect(sniffImageFormatMock).not.toHaveBeenCalled();
    expect(probeImagePreviewUrlMock).not.toHaveBeenCalled();
    expect(uploadPreviewImageMock).not.toHaveBeenCalled();
    expect(addClientDiagnosticMock).toHaveBeenCalledWith(
      'info',
      'test-preview',
      'Using trusted upstream preview',
      expect.objectContaining({ candidateKind: 'blob' }),
    );
  });

  it('renders a trusted data preview immediately without re-probing', async () => {
    const file = new File(['bytes'], 'photo.jpg', { type: 'image/jpeg' });
    const dataUrl = 'data:image/jpeg;base64,/9j/probed';

    render(
      <LocalMediaPreview
        kind="image"
        src={dataUrl}
        file={file}
        alt="Front"
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('rendered-media')).toHaveAttribute('src', dataUrl);
    });

    expect(sniffImageFormatMock).not.toHaveBeenCalled();
    expect(probeImagePreviewUrlMock).not.toHaveBeenCalled();
    expect(uploadPreviewImageMock).not.toHaveBeenCalled();
  });

  it('runs the full pipeline when no trusted upstream preview is provided', async () => {
    const file = new File(['bytes'], 'photo.jpg', { type: 'image/jpeg' });
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:raw-file');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    render(<LocalMediaPreview kind="image" src="" file={file} alt="Front" />);

    await waitFor(() => {
      expect(sniffImageFormatMock).toHaveBeenCalled();
      expect(probeImagePreviewUrlMock).toHaveBeenCalled();
    });

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
  });
});