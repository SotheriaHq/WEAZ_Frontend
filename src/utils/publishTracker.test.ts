import { beforeEach, describe, expect, it } from 'vitest';
import {
  createPublishTask,
  getPublishTaskDesignId,
  getPublishTaskLegacyCollectionId,
  getCompactPublishTaskStatusLabel,
  isLocalPublishTaskId,
  markPublishFailedDesignId,
  readPublishFailedDesignIds,
  clearPublishFailedDesignId,
  normalizePublishTaskIdentifiers,
  readPublishTasks,
  reconcilePublishTasksWithDraftIds,
  removePublishTask,
  type PublishTask,
} from './publishTracker';

const baseTask = (overrides: Partial<PublishTask>): PublishTask => ({
  id: 'task-1',
  ownerId: 'owner-1',
  title: 'Test design',
  startedAt: 1,
  status: 'uploading',
  progress: 0,
  updatedAt: 1,
  ...overrides,
});

describe('publishTracker identifiers', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('prefers designId while keeping legacy collection-backed ids', () => {
    const task = normalizePublishTaskIdentifiers(baseTask({
      designId: 'design-1',
      legacyCollectionId: 'legacy-collection-1',
      collectionId: 'legacy-collection-1',
    }));

    expect(getPublishTaskDesignId(task)).toBe('design-1');
    expect(getPublishTaskLegacyCollectionId(task)).toBe('legacy-collection-1');
    expect(task.collectionId).toBe('legacy-collection-1');
  });

  it('normalizes old collectionId-only tasks without deleting compatibility data', () => {
    const task = normalizePublishTaskIdentifiers(baseTask({
      collectionId: 'old-collection-backed-design',
    }));

    expect(task.designId).toBe('old-collection-backed-design');
    expect(task.legacyCollectionId).toBe('old-collection-backed-design');
    expect(task.collectionId).toBe('old-collection-backed-design');
  });

  it('preserves draft task kind and saved status for background draft cards', () => {
    const task = normalizePublishTaskIdentifiers(baseTask({
      kind: 'draft',
      status: 'saved',
      collectionId: 'draft-collection-1',
    }));

    expect(task.kind).toBe('draft');
    expect(task.status).toBe('saved');
    expect(getPublishTaskDesignId(task)).toBe('draft-collection-1');
  });

  it('formats compact status labels for pending cards', () => {
    expect(getCompactPublishTaskStatusLabel({ status: 'uploading', kind: 'publish', progress: 45 })).toBe('45%');
    expect(getCompactPublishTaskStatusLabel({ status: 'finalizing', kind: 'publish' })).toBe('Finishing…');
    expect(getCompactPublishTaskStatusLabel({ status: 'publish-failed', kind: 'publish' })).toBe('Failed');
    expect(getCompactPublishTaskStatusLabel({ status: 'published', kind: 'publish' })).toBe('Live');
  });

  it('returns verb-only label when progress is undefined (indeterminate case)', () => {
    // No progress available — UI should render an indeterminate skeleton, not a stuck %
    expect(getCompactPublishTaskStatusLabel({ status: 'uploading', kind: 'publish' })).toBe('Uploading…');
    expect(getCompactPublishTaskStatusLabel({ status: 'uploading', kind: 'draft' })).toBe('Saving…');
  });

  it('clamps progress to 99 max so the UI layer can detect and render indeterminate', () => {
    // progress=100 is clamped to 99 — CollectionCard renders shimmer skeleton for >=99
    expect(getCompactPublishTaskStatusLabel({ status: 'uploading', kind: 'publish', progress: 100 })).toBe('99%');
    expect(getCompactPublishTaskStatusLabel({ status: 'uploading', kind: 'publish', progress: 99 })).toBe('99%');
  });

  it('failed status label is stable regardless of progress value', () => {
    expect(getCompactPublishTaskStatusLabel({ status: 'publish-failed', kind: 'publish', progress: 99 })).toBe('Failed');
    expect(getCompactPublishTaskStatusLabel({ status: 'failed', kind: 'publish' })).toBe('Failed');
  });

  it('resolves server design id after reconciliation (dedup invariant)', () => {
    // After a successful upload the server assigns a real ID. updatePublishTask sets
    // designId = server-id. getPublishTaskDesignId must return the server id, NOT
    // the local publish_ prefixed task id — this is what Catalog uses to key
    // publishingStates so the dedup check (decoratedIds.has(key)) fires correctly.
    const task = normalizePublishTaskIdentifiers(baseTask({
      id: 'publish_abc123',
      designId: 'server-design-xyz',
      legacyCollectionId: 'server-design-xyz',
      collectionId: 'server-design-xyz',
      status: 'published',
    }));

    expect(getPublishTaskDesignId(task)).toBe('server-design-xyz');
    expect(task.id).toBe('publish_abc123');
    // The server id and local task id must differ — if they were the same the
    // dedup would fail to distinguish between the placeholder and the real card.
    expect(task.id).not.toBe(getPublishTaskDesignId(task));
  });

  it('identifies local publish task ids so UI never routes them as persisted designs', () => {
    expect(isLocalPublishTaskId('publish_1783327468928_r1mee6')).toBe(true);
    expect(isLocalPublishTaskId('11111111-1111-4111-8111-111111111111')).toBe(false);
    expect(isLocalPublishTaskId(null)).toBe(false);
  });

  it('keeps ephemeral data/blob previews in session memory but not localStorage', () => {
    const dataUrl = 'data:image/jpeg;base64,' + 'a'.repeat(5000);
    const dataTask = createPublishTask({
      ownerId: 'owner-1',
      title: 'Quota-safe task',
      coverPreviewUrl: dataUrl,
    });

    // In-memory read rehydrates session preview so catalog cards can show cover.
    expect(readPublishTasks({ ownerId: 'owner-1' })[0]?.coverPreviewUrl).toBe(dataUrl);
    // Persistence layer must never store data: / blob: URLs (Safari quota).
    const persisted = JSON.parse(window.localStorage.getItem('threadly.publish.designTasks.v2') || '[]') as Array<{
      id: string;
      coverPreviewUrl?: string;
    }>;
    expect(persisted.find((entry) => entry.id === dataTask.id)?.coverPreviewUrl).toBeUndefined();

    const blobTask = createPublishTask({
      ownerId: 'owner-1',
      title: 'Blob task',
      coverPreviewUrl: 'blob:https://weaz.me/local-preview',
    });
    expect(readPublishTasks({ ownerId: 'owner-1' }).some((task) => task.id === blobTask.id && task.coverPreviewUrl?.startsWith('blob:'))).toBe(true);
    const persistedAfterBlob = JSON.parse(window.localStorage.getItem('threadly.publish.designTasks.v2') || '[]') as Array<{
      coverPreviewUrl?: string;
    }>;
    expect(persistedAfterBlob.every((entry) => !entry.coverPreviewUrl?.startsWith('blob:') && !entry.coverPreviewUrl?.startsWith('data:'))).toBe(true);
  });

  it('reconciles failed local tasks when the server draft already exists', () => {
    const scope = { ownerId: 'owner-1' };
    const task = createPublishTask({
      ownerId: 'owner-1',
      title: 'Ghost draft',
      kind: 'draft',
    });
    removePublishTask(task.id, scope);
    createPublishTask({
      ownerId: 'owner-1',
      title: 'Ghost draft',
      kind: 'draft',
      designId: 'server-draft-uuid',
      legacyCollectionId: 'server-draft-uuid',
    });
    const failedTask = readPublishTasks(scope).find((entry) => entry.status === 'uploading');
    expect(failedTask).toBeTruthy();
    if (!failedTask) return;

    const stored = JSON.parse(window.localStorage.getItem('threadly.publish.designTasks.v2') || '[]') as PublishTask[];
    const patched = stored.map((entry) =>
      entry.id === failedTask.id
        ? { ...entry, status: 'failed' as const, designId: 'server-draft-uuid', legacyCollectionId: 'server-draft-uuid' }
        : entry,
    );
    window.localStorage.setItem('threadly.publish.designTasks.v2', JSON.stringify(patched));

    expect(readPublishTasks(scope).some((entry) => entry.status === 'failed')).toBe(true);
    expect(reconcilePublishTasksWithDraftIds(['server-draft-uuid'], scope)).toBe(1);
    expect(readPublishTasks(scope).some((entry) => entry.status === 'failed')).toBe(false);
  });
});

describe('publishTracker failed-publish markers', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('marks and reads a failed-publish design id within its owner scope', () => {
    const scope = { ownerId: 'owner-1' };
    markPublishFailedDesignId('design-1', { ownerId: 'owner-1', title: 'Jacket' });

    const ids = readPublishFailedDesignIds(scope);
    expect(ids.has('design-1')).toBe(true);
    // Survives the local-task reconcile invariant: the marker lives in its own
    // store, independent of the ephemeral publish task list.
    expect(readPublishTasks(scope)).toHaveLength(0);
  });

  it('scopes markers by owner so brands never see each other failures', () => {
    markPublishFailedDesignId('design-a', { ownerId: 'owner-1' });
    markPublishFailedDesignId('design-b', { ownerId: 'owner-2' });

    expect(readPublishFailedDesignIds({ ownerId: 'owner-1' }).has('design-a')).toBe(true);
    expect(readPublishFailedDesignIds({ ownerId: 'owner-1' }).has('design-b')).toBe(false);
    expect(readPublishFailedDesignIds({ ownerId: 'owner-2' }).has('design-b')).toBe(true);
  });

  it('clears a marker once the draft is finished or removed', () => {
    const scope = { ownerId: 'owner-1' };
    markPublishFailedDesignId('design-1', { ownerId: 'owner-1' });
    expect(readPublishFailedDesignIds(scope).has('design-1')).toBe(true);

    clearPublishFailedDesignId('design-1');
    expect(readPublishFailedDesignIds(scope).has('design-1')).toBe(false);
  });

  it('ignores blank ids and de-dupes repeated marks of the same design', () => {
    const scope = { ownerId: 'owner-1' };
    markPublishFailedDesignId('   ', { ownerId: 'owner-1' });
    markPublishFailedDesignId('design-1', { ownerId: 'owner-1' });
    markPublishFailedDesignId('design-1', { ownerId: 'owner-1', title: 'Updated' });

    expect(readPublishFailedDesignIds(scope).size).toBe(1);
    const stored = JSON.parse(
      window.localStorage.getItem('threadly.publish.failedDesignIds.v1') || '[]',
    ) as Array<{ designId: string }>;
    expect(stored.filter((entry) => entry.designId === 'design-1')).toHaveLength(1);
  });
});
