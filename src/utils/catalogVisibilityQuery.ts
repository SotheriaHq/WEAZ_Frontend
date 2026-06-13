export type CatalogVisibilityFilter =
  | 'Public'
  | 'Private'
  | 'Drafts'
  | 'In Review'
  | 'Changes Requested'
  | 'Rejected'
  | 'Deleted';

export const CATALOG_VISIBILITY_QUERY_ALIASES: Record<string, CatalogVisibilityFilter> = {
  public: 'Public',
  private: 'Private',
  drafts: 'Drafts',
  draft: 'Drafts',
  inreview: 'In Review',
  pendingreview: 'In Review',
  changesrequested: 'Changes Requested',
  rejected: 'Rejected',
  deleted: 'Deleted',
};

export const normalizeCatalogVisibilityQueryValue = (value?: string | null) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

export const resolveVisibilityFilterFromQuery = (searchParams: URLSearchParams): CatalogVisibilityFilter | null => {
  const raw =
    searchParams.get('visibility') ??
    searchParams.get('contentStatus') ??
    searchParams.get('status');
  const alias = CATALOG_VISIBILITY_QUERY_ALIASES[normalizeCatalogVisibilityQueryValue(raw)];
  return alias ?? null;
};
