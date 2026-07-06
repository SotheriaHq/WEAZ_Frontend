import { apiClient } from './httpClient';

export const uploadPreviewImage = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file, file.name);

  const response = await apiClient.post('/uploads/preview-image', formData, {
    responseType: 'blob',
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  const blob =
    response.data instanceof Blob
      ? response.data
      : new Blob([response.data], { type: 'image/jpeg' });

  return URL.createObjectURL(blob);
};
