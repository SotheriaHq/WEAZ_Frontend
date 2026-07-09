export type PublishTaskStatus = 'uploading' | 'finalizing' | 'published' | 'saved' | 'failed';
export type PublishTaskKind = 'publish' | 'draft';

export interface PublishTask {
  id: string;
  ownerId?: string;
  title: string;
  visibility?: 'PUBLIC' | 'PRIVATE';
  startedAt: number;
  status: PublishTaskStatus;
  kind?: PublishTaskKind;
  progress: number;
  coverPreviewUrl?: string;
  designId?: string;
  legacyCollectionId?: string;
  collectionId?: string;
  message?: string;
  error?: string;
  updatedAt: number;
}

export type CompactPublishStatusInput = {
  status: PublishTaskStatus | 'publishing' | 'publish-failed';
  kind?: PublishTaskKind;
  progress?: number | null;
};

type PublishTaskScope = {
  ownerId?: string | null;
};

const STORAGE_KEY = 'threadly.publish.designTasks.v2';
const LEGACY_STORAGE_KEY = 'threadly.publish.designTasks.v1';
const EVENT_NAME = 'threadly:publish-tasks-updated';
const MAX_TASKS_PER_SCOPE = 12;
const MAX_TOTAL_TASKS = 120;
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
const PUBLISHED_GRACE_MS = 30 * 1000;
const SAVED_GRACE_MS = 2 * 60 * 1000;
const MAX_PERSISTED_PREVIEW_URL_LENGTH = 4096;

const clampProgress = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
};

export const getCompactPublishTaskStatusLabel = ({
  status,
  kind = 'publish',
  progress,
}: CompactPublishStatusInput) => {
  if (status === 'published') return 'Live';
  if (status === 'saved') return 'Saved';
  if (status === 'failed' || status === 'publish-failed') return 'Failed';
  if (status === 'finalizing') return 'Finishing…';

  const safeProgress =
    typeof progress === 'number' && Number.isFinite(progress)
      ? Math.max(0, Math.min(99, Math.round(progress)))
      : null;
  // Prefer percent-only labels on cards so progress bars carry the state.
  if (safeProgress !== null) return `${safeProgress}%`;
  return kind === 'draft' ? 'Saving…' : 'Uploading…';
};

/**
 * Session-only preview URLs (blob:/data:) that must not enter localStorage.
 * Wired so catalog cards can still show a cover while an upload is in flight.
 */
const runtimePreviewByTaskId = new Map<string, string>();

export const setPublishTaskRuntimePreview = (
  taskId: string,
  previewUrl?: string | null,
) => {
  const id = String(taskId ?? '').trim();
  if (!id) return;
  const url = typeof previewUrl === 'string' ? previewUrl.trim() : '';
  if (!url) {
    runtimePreviewByTaskId.delete(id);
    return;
  }
  runtimePreviewByTaskId.set(id, url);
};

export const getPublishTaskRuntimePreview = (taskId?: string | null) => {
  const id = String(taskId ?? '').trim();
  if (!id) return undefined;
  return runtimePreviewByTaskId.get(id);
};

export const clearPublishTaskRuntimePreview = (taskId?: string | null) => {
  const id = String(taskId ?? '').trim();
  if (!id) return;
  runtimePreviewByTaskId.delete(id);
};

const normalizeOwnerId = (ownerId?: string | null) => {
  if (typeof ownerId !== 'string') return undefined;
  const trimmed = ownerId.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeEntityId = (value?: string | null) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const isLocalPublishTaskId = (value?: string | null): value is string =>
  typeof value === 'string' && value.trim().startsWith('publish_');

const sanitizePreviewUrlForStorage = (value?: string | null) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('filesystem:')
  ) {
    return undefined;
  }
  return trimmed.length <= MAX_PERSISTED_PREVIEW_URL_LENGTH ? trimmed : undefined;
};

const resolveScopeOwnerId = (scope?: PublishTaskScope) => {
  return normalizeOwnerId(scope?.ownerId);
};

const emitTasksUpdated = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
};

const isTaskLike = (value: unknown): value is PublishTask => {
  if (!value || typeof value !== 'object') return false;
  const task = value as Partial<PublishTask>;
  return (
    typeof task.id === 'string' &&
    (task.ownerId === undefined || typeof task.ownerId === 'string') &&
    typeof task.title === 'string' &&
    (task.visibility === undefined || task.visibility === 'PUBLIC' || task.visibility === 'PRIVATE') &&
    typeof task.startedAt === 'number' &&
    typeof task.status === 'string' &&
    typeof task.progress === 'number' &&
    typeof task.updatedAt === 'number'
  );
};

export const normalizePublishTaskIdentifiers = (task: PublishTask): PublishTask => {
  const legacyCollectionId =
    normalizeEntityId(task.legacyCollectionId) ??
    normalizeEntityId(task.collectionId);
  const designId =
    normalizeEntityId(task.designId) ??
    legacyCollectionId;

  return {
    ...task,
    ownerId: normalizeOwnerId(task.ownerId),
    kind: task.kind === 'draft' ? 'draft' : 'publish',
    designId,
    legacyCollectionId,
    // Compatibility only: older profile cards still key publish state by the
    // collection-backed design id while clients migrate to designId.
    collectionId: legacyCollectionId,
  };
};

const normalizePublishTaskForStorage = (task: PublishTask): PublishTask => ({
  ...normalizePublishTaskIdentifiers(task),
  coverPreviewUrl: sanitizePreviewUrlForStorage(task.coverPreviewUrl),
});

export const getPublishTaskDesignId = (task: Pick<PublishTask, 'designId' | 'legacyCollectionId' | 'collectionId'>) => (
  normalizeEntityId(task.designId) ??
  normalizeEntityId(task.legacyCollectionId) ??
  normalizeEntityId(task.collectionId)
);

export const getPublishTaskLegacyCollectionId = (task: Pick<PublishTask, 'legacyCollectionId' | 'collectionId' | 'designId'>) => (
  normalizeEntityId(task.legacyCollectionId) ??
  normalizeEntityId(task.collectionId) ??
  normalizeEntityId(task.designId)
);

const normalizeTaskList = (tasks: PublishTask[]) => {
  const now = Date.now();
  const fresh = tasks
    .filter((task) => {
      if (now - task.updatedAt > STALE_AFTER_MS) return false;
      if (task.status === 'published' && now - task.updatedAt > PUBLISHED_GRACE_MS) return false;
      if (task.status === 'saved' && now - task.updatedAt > SAVED_GRACE_MS) return false;
      return true;
    })
    .map(normalizePublishTaskForStorage)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const byScope = new Map<string, PublishTask[]>();
  for (const task of fresh) {
    const key = task.ownerId ?? '__legacy__';
    const existing = byScope.get(key) ?? [];
    if (existing.length < MAX_TASKS_PER_SCOPE) {
      existing.push(task);
      byScope.set(key, existing);
    }
  }

  return Array.from(byScope.values())
    .flat()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_TOTAL_TASKS);
};

const readRawPublishTasks = (): PublishTask[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    const parsed = JSON.parse(raw || legacyRaw || '[]');
    if (!Array.isArray(parsed)) return [];
    return normalizeTaskList(
      parsed
      .filter(isTaskLike)
        .map(normalizePublishTaskIdentifiers),
    );
  } catch {
    return [];
  }
};

const taskBelongsToScope = (task: PublishTask, scopeOwnerId: string | undefined) => {
  if (!scopeOwnerId) {
    return !task.ownerId;
  }
  return task.ownerId === scopeOwnerId;
};

export const readPublishTasks = (scope?: PublishTaskScope): PublishTask[] => {
  const scopeOwnerId = resolveScopeOwnerId(scope);
  return readRawPublishTasks()
    .filter((task) => taskBelongsToScope(task, scopeOwnerId))
    .map((task) => {
      const runtimePreview = getPublishTaskRuntimePreview(task.id);
      if (!runtimePreview || task.coverPreviewUrl) return task;
      return { ...task, coverPreviewUrl: runtimePreview };
    });
};

const writePublishTasks = (tasks: PublishTask[]) => {
  if (typeof window === 'undefined') return;
  const normalized = normalizeTaskList(tasks).map(normalizePublishTaskForStorage);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    try {
      const compact = normalized
        .map((task) => ({ ...task, coverPreviewUrl: undefined }))
        .slice(0, MAX_TASKS_PER_SCOPE);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(compact));
    } catch {
      // Safari/private-mode quota failures should not block the upload flow.
    }
  }
  emitTasksUpdated();
};

export const savePublishTasks = (tasks: PublishTask[]) => {
  writePublishTasks(tasks);
};

export const createPublishTask = (payload: {
  title: string;
  ownerId?: string | null;
  visibility?: 'PUBLIC' | 'PRIVATE';
  coverPreviewUrl?: string;
  designId?: string;
  legacyCollectionId?: string;
  collectionId?: string;
  message?: string;
  kind?: PublishTaskKind;
}): PublishTask => {
  const id = `publish_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  // Keep ephemeral previews (blob:/data:) in session memory only — localStorage
  // strips them, and without this map catalog cards lose cover while uploading.
  if (payload.coverPreviewUrl) {
    setPublishTaskRuntimePreview(id, payload.coverPreviewUrl);
  }
  const task: PublishTask = {
    id,
    ownerId: normalizeOwnerId(payload.ownerId),
    title: payload.title,
    visibility: payload.visibility,
    startedAt: now,
    status: 'uploading',
    kind: payload.kind === 'draft' ? 'draft' : 'publish',
    progress: 0,
    coverPreviewUrl: payload.coverPreviewUrl,
    designId: normalizeEntityId(payload.designId) ?? normalizeEntityId(payload.legacyCollectionId) ?? normalizeEntityId(payload.collectionId),
    legacyCollectionId: normalizeEntityId(payload.legacyCollectionId) ?? normalizeEntityId(payload.collectionId),
    collectionId: normalizeEntityId(payload.legacyCollectionId) ?? normalizeEntityId(payload.collectionId),
    message: payload.message,
    updatedAt: now,
  };

  const existing = readRawPublishTasks().filter((entry) => entry.id !== id);
  writePublishTasks([task, ...existing]);
  // Re-attach runtime preview after storage round-trip stripped ephemeral URLs.
  const runtimePreview = getPublishTaskRuntimePreview(id);
  return runtimePreview ? { ...task, coverPreviewUrl: runtimePreview } : task;
};

export const updatePublishTask = (
  id: string,
  update: Partial<Omit<PublishTask, 'id' | 'startedAt'>>,
  scope?: PublishTaskScope,
) => {
  const scopeOwnerId = resolveScopeOwnerId(scope);
  const tasks = readRawPublishTasks();
  const next = tasks.map((task) => {
    if (task.id !== id) return task;
    if (!taskBelongsToScope(task, scopeOwnerId)) return task;
    const merged: PublishTask = {
      ...task,
      ...update,
      ownerId:
        update.ownerId === undefined
          ? task.ownerId
          : normalizeOwnerId(update.ownerId),
      progress: update.progress === undefined ? task.progress : clampProgress(update.progress),
      updatedAt: Date.now(),
    };
    return normalizePublishTaskIdentifiers(merged);
  });
  writePublishTasks(next);
};

export const removePublishTask = (id: string, scope?: PublishTaskScope) => {
  const scopeOwnerId = resolveScopeOwnerId(scope);
  const next = readRawPublishTasks().filter((task) => {
    if (task.id !== id) return true;
    return !taskBelongsToScope(task, scopeOwnerId);
  });
  clearPublishTaskRuntimePreview(id);
  writePublishTasks(next);
};

export const prunePublishTasks = () => {
  writePublishTasks(readRawPublishTasks());
};

/**
 * Removes per-device "Failed - Retry" cards whose design row already exists on
 * the server. Publish tasks live in localStorage, so without this every device
 * that attempted a save keeps its own ghost even after another device succeeded.
 */
export const reconcilePublishTasksWithDraftIds = (
  draftIds: Iterable<string>,
  scope?: PublishTaskScope,
): number => {
  const draftIdSet =
    draftIds instanceof Set ? draftIds : new Set(Array.from(draftIds));
  if (draftIdSet.size === 0) return 0;

  const scopeOwnerId = resolveScopeOwnerId(scope);
  const tasks = readRawPublishTasks();
  let removed = 0;
  const next = tasks.filter((task) => {
    if (task.status !== 'failed') return true;
    if (!taskBelongsToScope(task, scopeOwnerId)) return true;
    const designId = getPublishTaskDesignId(task);
    const legacyCollectionId = getPublishTaskLegacyCollectionId(task);
    const isGhost =
      (designId && draftIdSet.has(designId)) ||
      (legacyCollectionId && draftIdSet.has(legacyCollectionId));
    if (isGhost) {
      removed += 1;
      return false;
    }
    return true;
  });

  if (removed > 0) {
    writePublishTasks(next);
  }
  return removed;
};

export const subscribePublishTasks = (listener: () => void) => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === LEGACY_STORAGE_KEY) {
      listener();
    }
  };
  const onCustom = () => listener();

  window.addEventListener('storage', onStorage);
  window.addEventListener(EVENT_NAME, onCustom);

  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(EVENT_NAME, onCustom);
  };
};
