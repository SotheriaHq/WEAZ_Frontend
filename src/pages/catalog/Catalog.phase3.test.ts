import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Phase 3 catalog stability contracts', () => {
  it('keeps delete optimistic without a blocking visible-list refetch', () => {
    const source = readSource('src/pages/catalog/Catalog.tsx');
    const deleteBlock = source.slice(
      source.indexOf('onConfirm={async () => {', source.indexOf('title={drafts.some')),
      source.indexOf('<ConfirmDialog', source.indexOf('title={drafts.some') + 1),
    );

    expect(deleteBlock).toContain('removeCollectionFromView(id)');
    expect(deleteBlock).toContain('restoreCollectionInView(id, removedSnapshot, isDraft)');
    expect(deleteBlock).not.toContain('setDraftsLoading(true)');
    expect(deleteBlock).not.toContain('fetchCollections(user.id, { forceRefresh: true })');
  });

  it('uses fixed cover thumbnails and preserves card object identity', () => {
    const cardSource = readSource('src/components/profile/CollectionCard.tsx');
    const entitySource = readSource('src/components/profile/CatalogEntityCard.tsx');

    expect(cardSource).toContain('aspect-[4/5]');
    expect(cardSource).toContain('object-cover');
    expect(cardSource).not.toContain('block w-full h-auto object-contain');
    expect(entitySource).not.toMatch(/collection=\{\{\s*\.\.\.collection/);
  });
});
