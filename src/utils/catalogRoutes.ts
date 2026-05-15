import type { CatalogEntityType } from '@/constants/catalogDomain';

type QueryInput =
  | string
  | URLSearchParams
  | Record<string, string | number | boolean | null | undefined>;

const normalizeId = (value?: string | null): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toSearchParams = (query?: QueryInput): URLSearchParams => {
  if (!query) return new URLSearchParams();
  if (typeof query === 'string') {
    return new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
  }
  if (query instanceof URLSearchParams) {
    return new URLSearchParams(query);
  }
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    params.set(key, String(value));
  });
  return params;
};

const withQuery = (path: string, query?: QueryInput): string => {
  const params = toSearchParams(query);
  const serialized = params.toString();
  return serialized ? `${path}?${serialized}` : path;
};

export function buildDesignRoute(input?: {
  designId?: string | null;
  legacyCollectionId?: string | null;
  mode?: 'create' | 'view' | 'edit';
  query?: QueryInput;
}): string {
  const mode = input?.mode ?? (input?.designId || input?.legacyCollectionId ? 'view' : 'create');
  if (mode === 'create') {
    return withQuery('/designs/create', input?.query);
  }

  const designId = normalizeId(input?.designId) ?? normalizeId(input?.legacyCollectionId);
  if (!designId) {
    return withQuery('/designs/create', input?.query);
  }

  const params = toSearchParams(input?.query);
  const legacyCollectionId = normalizeId(input?.legacyCollectionId);
  if (legacyCollectionId && legacyCollectionId !== designId && !params.has('legacyCollectionId')) {
    params.set('legacyCollectionId', legacyCollectionId);
  }

  return withQuery(
    `/designs/${encodeURIComponent(designId)}${mode === 'edit' ? '/edit' : ''}`,
    params,
  );
}

export function buildProductRoute(input?: {
  productId?: string | null;
  mode?: 'create' | 'view' | 'edit';
  query?: QueryInput;
}): string {
  const mode = input?.mode ?? (input?.productId ? 'view' : 'create');
  if (mode === 'create') {
    return withQuery('/products/create', input?.query);
  }

  const productId = normalizeId(input?.productId);
  if (!productId) {
    return withQuery('/products/create', input?.query);
  }

  return withQuery(
    `/products/${encodeURIComponent(productId)}${mode === 'edit' ? '/edit' : ''}`,
    input?.query,
  );
}

export function buildCollectionRoute(input?: {
  collectionId?: string | null;
  mode?: 'create' | 'view' | 'edit';
  query?: QueryInput;
}): string {
  const mode = input?.mode ?? (input?.collectionId ? 'view' : 'create');
  if (mode === 'create') {
    return withQuery('/collections/create', input?.query);
  }

  const collectionId = normalizeId(input?.collectionId);
  if (!collectionId) {
    return withQuery('/collections/create', input?.query);
  }

  return withQuery(
    `/collections/${encodeURIComponent(collectionId)}${mode === 'edit' ? '/edit' : ''}`,
    input?.query,
  );
}

export function buildCatalogEntityRoute(input: {
  entityType: CatalogEntityType;
  id?: string | null;
  legacyCollectionId?: string | null;
  mode?: 'create' | 'view' | 'edit';
  query?: QueryInput;
}): string {
  if (input.entityType === 'DESIGN') {
    return buildDesignRoute({
      designId: input.id,
      legacyCollectionId: input.legacyCollectionId,
      mode: input.mode,
      query: input.query,
    });
  }
  if (input.entityType === 'PRODUCT') {
    return buildProductRoute({ productId: input.id, mode: input.mode, query: input.query });
  }
  return buildCollectionRoute({ collectionId: input.id, mode: input.mode, query: input.query });
}
