const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isUuidV4 = (value?: string | null): value is string =>
  typeof value === 'string' && UUID_V4_PATTERN.test(value.trim());

export const normalizeUuidV4List = (
  values?: Array<string | null | undefined> | null,
): string[] =>
  Array.from(
    new Set(
      (values ?? [])
        .map((value) => String(value ?? '').trim())
        .filter(isUuidV4),
    ),
  ).sort();
