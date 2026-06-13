import { describe, expect, it } from 'vitest';
import {
  getPublishTaskDesignId,
  getPublishTaskLegacyCollectionId,
  getCompactPublishTaskStatusLabel,
  normalizePublishTaskIdentifiers,
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
});
