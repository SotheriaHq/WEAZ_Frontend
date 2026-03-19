export type PublishTaskStatus = 'uploading' | 'finalizing' | 'published' | 'failed';

export interface PublishTask {
  id: string;
  title: string;
  startedAt: number;
  status: PublishTaskStatus;
  progress: number;
  coverPreviewUrl?: string;
  collectionId?: string;
  message?: string;
  error?: string;
  updatedAt: number;
}

const STORAGE_KEY = 'threadly.publish.designTasks.v1';
const EVENT_NAME = 'threadly:publish-tasks-updated';
const MAX_TASKS = 12;
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
const PUBLISHED_GRACE_MS = 30 * 1000;

const clampProgress = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
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
    typeof task.title === 'string' &&
    typeof task.startedAt === 'number' &&
    typeof task.status === 'string' &&
    typeof task.progress === 'number' &&
    typeof task.updatedAt === 'number'
  );
};

export const readPublishTasks = (): PublishTask[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed
      .filter(isTaskLike)
      .filter((task) => {
        if (now - task.updatedAt > STALE_AFTER_MS) return false;
        if (task.status === 'published' && now - task.updatedAt > PUBLISHED_GRACE_MS) return false;
        return true;
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_TASKS);
  } catch {
    return [];
  }
};

const writePublishTasks = (tasks: PublishTask[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks.slice(0, MAX_TASKS)));
  emitTasksUpdated();
};

export const savePublishTasks = (tasks: PublishTask[]) => {
  writePublishTasks(tasks);
};

export const createPublishTask = (payload: {
  title: string;
  coverPreviewUrl?: string;
  collectionId?: string;
  message?: string;
}): PublishTask => {
  const id = `publish_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  const task: PublishTask = {
    id,
    title: payload.title,
    startedAt: now,
    status: 'uploading',
    progress: 0,
    coverPreviewUrl: payload.coverPreviewUrl,
    collectionId: payload.collectionId,
    message: payload.message,
    updatedAt: now,
  };

  const existing = readPublishTasks().filter((entry) => entry.id !== id);
  writePublishTasks([task, ...existing]);
  return task;
};

export const updatePublishTask = (id: string, update: Partial<Omit<PublishTask, 'id' | 'startedAt'>>) => {
  const tasks = readPublishTasks();
  const next = tasks.map((task) => {
    if (task.id !== id) return task;
    const merged: PublishTask = {
      ...task,
      ...update,
      progress: update.progress === undefined ? task.progress : clampProgress(update.progress),
      updatedAt: Date.now(),
    };
    return merged;
  });
  writePublishTasks(next);
};

export const removePublishTask = (id: string) => {
  const next = readPublishTasks().filter((task) => task.id !== id);
  writePublishTasks(next);
};

export const prunePublishTasks = () => {
  writePublishTasks(readPublishTasks());
};

export const subscribePublishTasks = (listener: () => void) => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  const onCustom = () => listener();

  window.addEventListener('storage', onStorage);
  window.addEventListener(EVENT_NAME, onCustom);

  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(EVENT_NAME, onCustom);
  };
};
