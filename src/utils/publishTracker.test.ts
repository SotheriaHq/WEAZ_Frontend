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
});
