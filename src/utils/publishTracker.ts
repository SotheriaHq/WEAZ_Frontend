export type PublishTaskStatus = 'uploading' | 'finalizing' | 'published' | 'failed';

export interface PublishTask {
  id: string;
  ownerId?: string;
  title: string;
  visibility?: 'PUBLIC' | 'PRIVATE';
  startedAt: number;
  status: PublishTaskStatus;
  progress: number;
  coverPreviewUrl?: string;
  designId?: string;
  legacyCollectionId?: string;
  collectionId?: string;
  message?: string;
  error?: string;
  updatedAt: number;
}

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

const clampProgress = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
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
    designId,
    legacyCollectionId,
    // Compatibility only: older profile cards still key publish state by the
    // collection-backed design id while clients migrate to designId.
    collectionId: legacyCollectionId,
  };
};

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
      return true;
    })
    .map(normalizePublishTaskIdentifiers)
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
  return readRawPublishTasks().filter((task) => taskBelongsToScope(task, scopeOwnerId));
};

const writePublishTasks = (tasks: PublishTask[]) => {
  if (typeof window === 'undefined') return;
  const normalized = normalizeTaskList(tasks);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
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
}): PublishTask => {
  const id = `publish_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  const task: PublishTask = {
    id,
    ownerId: normalizeOwnerId(payload.ownerId),
    title: payload.title,
    visibility: payload.visibility,
    startedAt: now,
    status: 'uploading',
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
  return task;
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
  writePublishTasks(next);
};

export const prunePublishTasks = () => {
  writePublishTasks(readRawPublishTasks());
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
