export type CreatorAudience = "FEMALE" | "MALE" | "EVERYBODY";

export const CREATOR_AUDIENCE_OPTIONS: Array<{
  value: CreatorAudience;
  label: string;
}> = [
  { value: "FEMALE", label: "Womenswear" },
  { value: "MALE", label: "Menswear" },
  { value: "EVERYBODY", label: "Unisex / Everybody" },
];

export const CREATOR_METADATA_HELP = {
  audience:
    "Choose the people this item is mainly designed for. This helps buyers discover styles that fit them.",
  style:
    "Pick the visual style of this look, such as casual, corporate, luxury, modest, or statement.",
  heritage:
    "Add cultural or heritage signals like Ankara, Aso Ebi, Adire, or African-inspired.",
  occasion:
    "Choose the occasions this look fits, such as wedding, office, party, church, or everyday wear.",
  hashtags: "Add searchable social tags. Use words buyers may search for.",
  visibility:
    "Choose whether this is visible to everyone or kept private while you work.",
} as const;

export const CREATOR_FILTER_DIMENSION_LABELS: Record<string, string> = {
  style: "Style details",
  heritage: "Cultural vibe",
  occasion: "Where would you wear it?",
  fabric: "Fabric",
  "color-family": "Color family",
  fit: "Fit",
};

export const CREATOR_FILTER_DIMENSION_HELP: Record<string, string> = {
  style: CREATOR_METADATA_HELP.style,
  heritage: CREATOR_METADATA_HELP.heritage,
  occasion: CREATOR_METADATA_HELP.occasion,
  fabric: "Choose the physical textile or material used, such as Ankara fabric.",
  "color-family": "Choose the main color family buyers would recognize.",
  fit: "Choose how the item is intended to sit on the body.",
};

export const CREATOR_FILTER_DIMENSION_ORDER = [
  "style",
  "heritage",
  "occasion",
  "fabric",
  "color-family",
  "fit",
] as const;

export const LEGACY_DISCOVERY_DIMENSION_SLUGS = new Set([
  "fabric-type",
  "fit-shape",
  "designer-location",
  "price-range",
]);

export function getAudienceLabel(value?: string | null): string {
  return (
    CREATOR_AUDIENCE_OPTIONS.find((option) => option.value === value)?.label ||
    "Unisex / Everybody"
  );
}

export function getDiscoveryDimensionLabel(
  slug?: string | null,
  fallbackName?: string | null,
): string {
  const normalizedSlug = String(slug ?? "").trim().toLowerCase();
  return (
    CREATOR_FILTER_DIMENSION_LABELS[normalizedSlug] ||
    String(fallbackName ?? "").trim() ||
    "Style details"
  );
}

export function getDiscoveryDimensionHelp(slug?: string | null): string | null {
  const normalizedSlug = String(slug ?? "").trim().toLowerCase();
  return CREATOR_FILTER_DIMENSION_HELP[normalizedSlug] ?? null;
}

export function getSelectedFilterValueIds(
  selection: Record<string, string[]>,
): string[] {
  return Array.from(
    new Set(
      Object.values(selection)
        .flatMap((ids) => (Array.isArray(ids) ? ids : []))
        .filter((id): id is string => typeof id === "string" && id.trim().length > 0),
    ),
  );
}

export function normalizeHashtagLabel(tag: string): string {
  const normalized = tag.trim().replace(/^#+/, "");
  return normalized ? `#${normalized}` : "#";
}

export function mapCreatorMetadataError(raw: unknown, fallback: string): string {
  const message = Array.isArray(raw) ? raw[0] : raw;
  const normalized = String(message ?? "").trim();
  if (!normalized) return fallback;

  const lower = normalized.toLowerCase();
  if (
    lower.includes("categoryid") ||
    lower.includes("category id") ||
    lower.includes("category is required") ||
    lower.includes("select a category") ||
    lower.includes("choose a category")
  ) {
    return "Choose what this item is.";
  }

  if (
    lower.includes("categorytypeid") ||
    lower.includes("subcategoryid") ||
    lower.includes("sub-category") ||
    lower.includes("subcategory") ||
    lower.includes("garment type")
  ) {
    return "Choose a garment type.";
  }

  if (
    lower.includes("audience") ||
    lower.includes("gender") ||
    lower.includes(" type ") ||
    lower.includes("collectiontype")
  ) {
    return "Choose who this item is for.";
  }

  if (
    lower.includes("filtervalueids") ||
    lower.includes("filter value") ||
    lower.includes("entityfilter") ||
    lower.includes("filterdimension") ||
    lower.includes("style details") ||
    lower.includes("selected style")
  ) {
    return "Add at least one style detail.";
  }

  if (lower.includes("tag") || lower.includes("hashtag")) {
    return "Add at least one hashtag.";
  }

  return normalized;
}
