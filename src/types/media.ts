export type MediaItemKind = 'image' | 'video';

export interface MediaItem {
  id: string;
  file?: File;
  previewUrl: string;
  kind: MediaItemKind;
  remoteId?: string;
}