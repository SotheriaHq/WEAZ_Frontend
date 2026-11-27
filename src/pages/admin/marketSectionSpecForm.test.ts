import { describe, expect, it } from 'vitest';
import type { AdminMarketSectionTemplate } from '@/types/admin';
import {
  editorTemplates,
  formFromSpec,
  fromLocalInput,
  isValidSectionKey,
  specFromForm,
  toLocalInput,
  validateSectionForm,
} from './marketSectionSpecForm';

const template = (overrides: Partial<AdminMarketSectionTemplate>): AdminMarketSectionTemplate => ({
  template: 'CATALOG_FILTER',
  title: 'Explore the Market',
  policy: 'recency',
  entityType: 'PRODUCT',
  sorts: ['newest', 'price_asc', 'price_desc'],
  signedInOnly: false,
  regional: false,
  ...overrides,
});

const catalogFilter = template({});

describe('market section spec form', () => {
  it('hides personal and regional templates behind their legal gates', () => {
    const shown = editorTemplates([
      catalogFilter,
      template({ template: 'AFFINITY', signedInOnly: true }),
      template({ template: 'REGIONAL_POPULAR', regional: true }),
    ]);
    expect(shown.map((item) => item.template)).toEqual(['CATALOG_FILTER']);
  });

  it('accepts only the server section-key shape', () => {
    expect(isValidSectionKey('adire-casual')).toBe(true);
    expect(isValidSectionKey('Adire Casual')).toBe(false);
    expect(isValidSectionKey('-adire')).toBe(false);
  });

  it('round-trips a CATALOG_FILTER spec and keeps fields the form does not edit', () => {
    const base = {
      key: 'adire-casual',
      version: 3,
      template: 'CATALOG_FILTER',
      title: 'Adire casual',
      subtitle: null,
      status: 'ACTIVE' as const,
      placement: { surface: 'HOME', order: 8 },
      capacity: { preview: 8, page: 24, minItems: 4 },
      schedule: { startsAt: null, endsAt: null },
      filters: { tags: ['adire'], brandIds: ['b1'], price: { min: 5000 } },
      params: { maxPerBrand: 2 },
      fallback: ['fresh-drops'],
    };
    const form = formFromSpec(base, 'NEW_RELEASES');
    expect(form).toEqual(
      expect.objectContaining({ template: 'CATALOG_FILTER', tags: 'adire', priceMin: '5000', minItems: '4' }),
    );

    const spec = specFromForm({ ...form, colors: 'indigo, indigo , blue', onSale: true }, base);
    expect(spec.key).toBeUndefined();
    expect(spec.version).toBeUndefined();
    expect(spec.filters).toEqual({
      tags: ['adire'],
      brandIds: ['b1'],
      colors: ['indigo', 'blue'],
      price: { min: 5000 },
      onSale: true,
    });
    expect(spec.params).toEqual({ maxPerBrand: 2 });
    expect(spec.fallback).toEqual(['fresh-drops']);
    expect(spec.placement).toEqual({ surface: 'HOME', order: 8 });
  });

  it('drops template-owned sorts when the template changes', () => {
    const base = { template: 'TREND', sorts: ['trending'], rankingPolicy: 'trend' };
    const spec = specFromForm({ ...formFromSpec(base, 'TREND'), template: 'CATALOG_FILTER' }, base);
    expect(spec.sorts).toBeUndefined();
    expect(spec.rankingPolicy).toBeUndefined();
  });

  it('converts schedule times to the exact ISO form the server accepts', () => {
    const iso = fromLocalInput('2026-12-01T09:30');
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/);
    expect(toLocalInput(iso)).toBe('2026-12-01T09:30');
    expect(fromLocalInput('')).toBeNull();
  });

  it('explains dishonest titles and out-of-range numbers before a round trip', () => {
    const form = formFromSpec(null, 'CATALOG_FILTER');
    expect(validateSectionForm({ ...form, title: 'Trending adire' }, catalogFilter).title).toMatch(
      /Trend template/,
    );
    expect(validateSectionForm({ ...form, title: 'Picked for you' }, catalogFilter).title).toMatch(
      /personal template/,
    );
    expect(validateSectionForm({ ...form, title: 'New adire' }, catalogFilter).title).toMatch(/New/);
    const errors = validateSectionForm(
      { ...form, preview: '4', minItems: '6', page: '8', priceMin: '900', priceMax: '100' },
      catalogFilter,
    );
    expect(errors.minItems).toBe('Use a whole number from 1 to 4.');
    expect(errors.page).toBeDefined();
    expect(errors.priceMax).toBeDefined();
    expect(validateSectionForm({ ...form, title: 'Adire casual' }, catalogFilter)).toEqual({});
  });

  it('requires a placement key for curated templates and sends it only there', () => {
    const curated = template({ template: 'CURATED_LIST' });
    const form = { ...formFromSpec(null, 'CURATED_LIST'), title: 'Style picks' };
    expect(validateSectionForm(form, curated).placementKey).toBeDefined();
    const valid = { ...form, placementKey: 'STYLE_PICKS' };
    expect(validateSectionForm(valid, curated)).toEqual({});
    expect(specFromForm(valid, null).curated).toEqual({ placementKey: 'STYLE_PICKS' });
    expect(specFromForm({ ...valid, template: 'CATALOG_FILTER' }, null).curated).toBeUndefined();
  });
});
