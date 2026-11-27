import type {
  AdminMarketSectionSpec,
  AdminMarketSectionSpecStatus,
  AdminMarketSectionTemplate,
} from '@/types/admin';

/**
 * Pure helpers for the Market section publishing form. The server parser
 * (`parsePipelineSpec`) is the authority; these mirror its bounds only to give
 * an admin a specific message before a round trip.
 */
export interface SectionSpecForm {
  template: string;
  title: string;
  subtitle: string;
  status: Exclude<AdminMarketSectionSpecStatus, 'ARCHIVED'>;
  order: string;
  preview: string;
  minItems: string;
  page: string;
  startsAt: string;
  endsAt: string;
  tags: string;
  colors: string;
  sizes: string;
  priceMin: string;
  priceMax: string;
  onSale: boolean;
  inStockOnly: boolean;
  placementKey: string;
}

export type SectionSpecFormErrors = Partial<Record<keyof SectionSpecForm, string>>;

const SECTION_KEY = /^[a-z0-9][a-z0-9-]{0,79}$/;
const PLACEMENT_KEY = /^[A-Z0-9_:-]+$/;
const CURATED_TEMPLATES = new Set(['CURATED_LIST', 'LOOKS']);
const NEW_TEMPLATES = new Set(['NEW_RELEASES', 'NEW_DESIGNERS', 'CURATED_LIST']);

/** Personal and regional templates stay behind their legal gates (WP11, WP12). */
export function editorTemplates(templates: readonly AdminMarketSectionTemplate[]) {
  return templates.filter((template) => !template.signedInOnly && !template.regional);
}

export function isValidSectionKey(value: string): boolean {
  return SECTION_KEY.test(value);
}

export function needsPlacementKey(template: string): boolean {
  return CURATED_TEMPLATES.has(template);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function list(value: unknown): string {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string').join(', ') : '';
}

function numberText(value: unknown, fallback: number): string {
  return typeof value === 'number' ? String(value) : String(fallback);
}

/** ISO instant → `datetime-local` value in the admin's own time zone. */
export function toLocalInput(iso: unknown): string {
  if (typeof iso !== 'string' || !iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** `datetime-local` value → the exact ISO form the server parser accepts. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function formFromSpec(
  spec: AdminMarketSectionSpec | null,
  fallbackTemplate: string,
): SectionSpecForm {
  const placement = record(spec?.placement);
  const capacity = record(spec?.capacity);
  const schedule = record(spec?.schedule);
  const filters = record(spec?.filters);
  const price = record(filters.price);
  const curated = record(spec?.curated);
  const status = spec?.status;
  return {
    template: typeof spec?.template === 'string' ? spec.template : fallbackTemplate,
    title: typeof spec?.title === 'string' ? spec.title : '',
    subtitle: typeof spec?.subtitle === 'string' ? spec.subtitle : '',
    status: status === 'DRAFT' || status === 'PAUSED' ? status : 'ACTIVE',
    order: numberText(placement.order, 0),
    preview: numberText(capacity.preview, 8),
    minItems: numberText(capacity.minItems, 2),
    page: numberText(capacity.page, 24),
    startsAt: toLocalInput(schedule.startsAt),
    endsAt: toLocalInput(schedule.endsAt),
    tags: list(filters.tags),
    colors: list(filters.colors),
    sizes: list(filters.sizes),
    priceMin: typeof price.min === 'number' ? String(price.min) : '',
    priceMax: typeof price.max === 'number' ? String(price.max) : '',
    onSale: filters.onSale === true,
    inStockOnly: filters.inStockOnly === true,
    placementKey: typeof curated.placementKey === 'string' ? curated.placementKey : '',
  };
}

function splitList(value: string): string[] {
  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
}

function integer(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function inRange(value: string, min: number, max: number): boolean {
  const parsed = integer(value);
  return parsed !== null && parsed >= min && parsed <= max;
}

/** Mirrors the server's honest-title rule so the admin learns which word to change. */
export function titleClaimError(
  form: Pick<SectionSpecForm, 'title' | 'subtitle' | 'template'>,
  template: AdminMarketSectionTemplate | undefined,
): string | null {
  const title = form.title.trim() || template?.title || '';
  const claim = `${title} ${form.subtitle.trim()}`;
  if (
    /\b(for you|near you|you like|your|picked for)\b/i.test(claim) &&
    !template?.signedInOnly &&
    !template?.regional
  )
    return 'Personal wording ("for you", "your", "near you") needs a personal template.';
  if (/\b(trending|hot)\b/i.test(claim) && form.template !== 'TREND')
    return '"Trending" or "hot" is only honest on the Trend template.';
  if (/\bnew\b/i.test(claim) && !NEW_TEMPLATES.has(form.template))
    return '"New" is only honest on New releases, New designers or a curated list.';
  return null;
}

export function validateSectionForm(
  form: SectionSpecForm,
  template: AdminMarketSectionTemplate | undefined,
): SectionSpecFormErrors {
  const errors: SectionSpecFormErrors = {};
  if (!template) errors.template = 'Choose a template.';
  if (form.title.length > 120) errors.title = 'Keep the title to 120 characters.';
  if (form.subtitle.length > 240) errors.subtitle = 'Keep the subtitle to 240 characters.';
  const claim = titleClaimError(form, template);
  if (claim) errors.title = claim;
  if (!inRange(form.order, 0, 100)) errors.order = 'Use a whole number from 0 to 100.';
  if (!inRange(form.preview, 1, 12)) errors.preview = 'Use a whole number from 1 to 12.';
  const preview = integer(form.preview) ?? 12;
  if (!inRange(form.minItems, 1, preview))
    errors.minItems = `Use a whole number from 1 to ${preview}.`;
  if (!inRange(form.page, 12, 60)) errors.page = 'Use a whole number from 12 to 60.';
  const startsAt = fromLocalInput(form.startsAt);
  const endsAt = fromLocalInput(form.endsAt);
  if (form.startsAt && !startsAt) errors.startsAt = 'Enter a valid date and time.';
  if (form.endsAt && !endsAt) errors.endsAt = 'Enter a valid date and time.';
  if (startsAt && endsAt && startsAt >= endsAt) errors.endsAt = 'End after the start.';
  for (const field of ['priceMin', 'priceMax'] as const) {
    if (form[field].trim() && integer(form[field]) === null)
      errors[field] = 'Use a whole number.';
  }
  const min = integer(form.priceMin);
  const max = integer(form.priceMax);
  if (min !== null && max !== null && min > max)
    errors.priceMax = 'Use a maximum above the minimum.';
  if (needsPlacementKey(form.template) && !PLACEMENT_KEY.test(form.placementKey.trim()))
    errors.placementKey = 'Use capitals, digits, _ : or - (for example STYLE_PICKS).';
  return errors;
}

/**
 * Applies the form over the spec it was loaded from, so fields the form does
 * not edit (params, fallback, audience, other filters) are kept.
 */
export function specFromForm(
  form: SectionSpecForm,
  base: AdminMarketSectionSpec | null,
): AdminMarketSectionSpec {
  const spec: AdminMarketSectionSpec = { ...(base ?? {}) };
  // The server owns identity and version.
  delete spec.key;
  delete spec.version;
  if (base?.template !== undefined && base.template !== form.template) {
    // Sorts and ranking policy belong to a template; let the server default them.
    delete spec.sorts;
    delete spec.rankingPolicy;
  }
  spec.template = form.template;
  const title = form.title.trim();
  if (title) spec.title = title;
  else delete spec.title;
  spec.subtitle = form.subtitle.trim() || null;
  spec.status = form.status;
  spec.placement = { ...record(base?.placement), order: integer(form.order) ?? 0 };
  spec.capacity = {
    preview: integer(form.preview) ?? 8,
    page: integer(form.page) ?? 24,
    minItems: integer(form.minItems) ?? 2,
  };
  spec.schedule = { startsAt: fromLocalInput(form.startsAt), endsAt: fromLocalInput(form.endsAt) };

  const filters: Record<string, unknown> = { ...record(base?.filters) };
  for (const [field, value] of [
    ['tags', form.tags],
    ['colors', form.colors],
    ['sizes', form.sizes],
  ] as const) {
    const values = splitList(value);
    if (values.length) filters[field] = values;
    else delete filters[field];
  }
  const price: Record<string, number> = {};
  const min = integer(form.priceMin);
  const max = integer(form.priceMax);
  if (min !== null) price.min = min;
  if (max !== null) price.max = max;
  if (Object.keys(price).length) filters.price = price;
  else delete filters.price;
  if (form.onSale) filters.onSale = true;
  else delete filters.onSale;
  if (form.inStockOnly) filters.inStockOnly = true;
  else delete filters.inStockOnly;
  spec.filters = filters;

  if (needsPlacementKey(form.template) && form.placementKey.trim())
    spec.curated = { placementKey: form.placementKey.trim() };
  else delete spec.curated;
  return spec;
}
