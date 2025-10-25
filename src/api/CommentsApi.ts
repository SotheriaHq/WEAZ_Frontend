import { apiClient } from './httpClient';
import type { CommentTarget, CommentV2Dto, PageResult } from '@/types/comments';

function pathForTarget(targetType: CommentTarget, targetId: string) {
  if (targetType === 'POST') return `/api/v1/posts/${targetId}/comments`;
  if (targetType === 'COLLECTION') return `/api/v1/collections/${targetId}/comments`;
  return `/api/v1/collections/media/${targetId}/comments`;
}

export const CommentsApi = {
  async create(targetType: CommentTarget, targetId: string, content: string, parentId?: string) {
    const { data } = await apiClient.post(pathForTarget(targetType, targetId), { content, parentId });
    return data as CommentV2Dto;
  },
  async list(targetType: CommentTarget, targetId: string, cursor?: string, limit = 20) {
    const { data } = await apiClient.get(pathForTarget(targetType, targetId), { params: { cursor, limit } });
    return data as PageResult<CommentV2Dto>;
  },
  async replies(commentId: string, cursor?: string, limit = 20) {
    const { data } = await apiClient.get(`/api/v1/comments/${commentId}/replies`, { params: { cursor, limit } });
    return data as PageResult<CommentV2Dto>;
  },
  async toggleLike(commentId: string) {
    const clientEventId = (globalThis.crypto && 'randomUUID' in globalThis.crypto)
      ? (globalThis.crypto as any).randomUUID()
      : undefined;
    const { data } = await apiClient.post(`/api/v1/comments/${commentId}/like`, {}, {
      headers: clientEventId ? { 'x-client-event-id': clientEventId } : undefined,
    });
    return data as { liked: boolean; likeCount: number };
  },
  async isLiked(commentId: string) {
    const { data } = await apiClient.get(`/api/v1/comments/${commentId}/is-liked`);
    return data as { liked: boolean };
  },
  async remove(commentId: string) {
    const { data } = await apiClient.delete(`/api/v1/comments/${commentId}`);
    return data as { success: boolean };
  },
  async stats(commentId: string) {
    const { data } = await apiClient.get(`/api/v1/comments/${commentId}/stats`);
    return data as { likeCount: number; replyCount: number };
  },
};

