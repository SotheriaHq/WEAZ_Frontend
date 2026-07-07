import { beforeEach, describe, expect, it } from 'vitest';
import {
  createPublishTask,
  getPublishTaskDesignId,
  getPublishTaskLegacyCollectionId,
  getCompactPublishTaskStatusLabel,
  isLocalPublishTaskId,
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
    expect(getCompactPublishTaskStatusLabel({ status: 'uploading', kind: 'publish', progress: 45 })).toBe('Uploading... 45%');
    expect(getCompactPublishTaskStatusLabel({ status: 'finalizing', kind: 'publish' })).toBe('Finalizing...');
    expect(getCompactPublishTaskStatusLabel({ status: 'publish-failed', kind: 'publish' })).toBe('Failed - Retry');
    expect(getCompactPublishTaskStatusLabel({ status: 'published', kind: 'publish' })).toBe('Live');
  });

  it('returns verb-only label when progress is undefined (indeterminate case)', () => {
    // No progress available — UI should render an indeterminate skeleton, not a stuck %
    expect(getCompactPublishTaskStatusLabel({ status: 'uploading', kind: 'publish' })).toBe('Uploading...');
    expect(getCompactPublishTaskStatusLabel({ status: 'uploading', kind: 'draft' })).toBe('Saving...');
  });

  it('clamps progress to 99 max so the UI layer can detect and render indeterminate', () => {
    // progress=100 is clamped to 99 — CollectionCard renders shimmer skeleton for >=99
    expect(getCompactPublishTaskStatusLabel({ status: 'uploading', kind: 'publish', progress: 100 })).toBe('Uploading... 99%');
    expect(getCompactPublishTaskStatusLabel({ status: 'uploading', kind: 'publish', progress: 99 })).toBe('Uploading... 99%');
  });

  it('failed status label is stable regardless of progress value', () => {
    expect(getCompactPublishTaskStatusLabel({ status: 'publish-failed', kind: 'publish', progress: 99 })).toBe('Failed - Retry');
    expect(getCompactPublishTaskStatusLabel({ status: 'failed', kind: 'publish' })).toBe('Failed - Retry');
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

  it('does not persist local data/blob preview URLs in publish tasks', () => {
    createPublishTask({
      ownerId: 'owner-1',
      title: 'Quota-safe task',
      coverPreviewUrl: 'data:image/jpeg;base64,' + 'a'.repeat(5000),
    });

    expect(readPublishTasks({ ownerId: 'owner-1' })[0]?.coverPreviewUrl).toBeUndefined();

    createPublishTask({
      ownerId: 'owner-1',
      title: 'Blob task',
      coverPreviewUrl: 'blob:https://weaz.me/local-preview',
    });

    expect(
      readPublishTasks({ ownerId: 'owner-1' }).every((task) => !task.coverPreviewUrl),
    ).toBe(true);
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
