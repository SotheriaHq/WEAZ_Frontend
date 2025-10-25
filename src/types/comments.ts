export type CommentTarget = 'POST' | 'COLLECTION' | 'COLLECTION_MEDIA';

export interface UserSummary {
  id: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImage?: string | null;
}

export interface CommentV2Dto {
  id: string;
  targetType: CommentTarget;
  targetId: string;
  userId: string;
  user: UserSummary;
  parentId?: string | null;
  depth: number;
  contentRaw?: string | null;
  contentSanitized: string;
  likeCount: number;
  replyCount: number;
  createdAt: string;
  updatedAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  isLikedByMe?: boolean;
  children?: CommentV2Dto[];
}

export interface PageResult<T> {
  items: T[];
  hasNextPage: boolean;
  endCursor: string | null;
}

