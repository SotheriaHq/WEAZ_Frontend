/**
 * Filter-driven hashtag suggestions.
 * These are social/search tags only; structured metadata remains the source of
 * truth for category, audience, style, heritage, occasion, fabric, color, and fit.
 */
export const FILTER_TAG_SUGGESTIONS: Record<string, string[]> = {
  // Style
  "casual-streetwear": ["street-style", "casual-style", "daily-wear"],
  "formal-corporate": ["office-style", "corporate-style", "work-outfit"],
  "evening-luxury": ["luxury-style", "evening-wear", "statement-piece"],
  "bridal-wedding": ["bridal", "wedding-guest", "wedding-fashion"],
  minimalist: ["minimalist-fashion", "clean-style", "simple-elegance"],
  modest: ["modest-fashion", "covered-style", "sunday-best"],
  "statement-bold": ["statement-piece", "bold-style", "standout-look"],
  "vintage-retro": ["vintage-style", "retro-fashion", "throwback-style"],
  everyday: ["daily-wear", "everyday-style", "easy-style"],
  contemporary: ["modern-fashion", "contemporary-style", "modern-african"],

  // Heritage
  "african-cultural": ["african-fashion", "modern-african", "cultural-style"],
  ankara: ["ankara-fashion", "african-prints", "bold-prints"],
  "aso-ebi": ["aso-ebi", "owambe", "wedding-guest"],
  adire: ["adire", "indigenous-craft", "hand-dyed"],
  lace: ["lace-style", "lacewear", "elegant"],
  "aso-oke": ["aso-oke", "yoruba-fashion", "owambe"],
  kente: ["kente", "ghanaian-fashion", "woven-textiles"],
  kampala: ["kampala", "adire", "african-fashion"],
  dashiki: ["dashiki", "afro-modern", "african-fashion"],
  "yoruba-traditional": ["yoruba-fashion", "aso-oke", "owambe"],
  "igbo-traditional": ["igbo-fashion", "isi-agu", "coral-beads"],
  "hausa-arewa-traditional": ["arewa-fashion", "hausa-fashion", "modest-fashion"],
  "isi-agu": ["isi-agu", "igbo-fashion", "traditional-style"],
  "coral-beads-royal-traditional": ["coral-beads", "royal-traditional", "bridal"],
  "afro-modern": ["afro-modern", "modern-african", "afro-fusion"],

  // Occasion
  "office-work": ["office-style", "work-outfit", "corporate-style"],
  wedding: ["wedding-guest", "aso-ebi", "bridal"],
  "owambe-party": ["owambe", "party-wear", "aso-ebi"],
  "date-night": ["date-style", "evening-wear", "night-out"],
  "religious-event": ["church-outfit", "modest-fashion", "sunday-best"],
  "festival-cultural-event": ["festival-style", "cultural-style", "african-fashion"],
  graduation: ["grad-look", "celebration-style", "occasion-wear"],
  birthday: ["birthday-look", "party-wear", "statement-piece"],
  "red-carpet": ["red-carpet", "luxury-style", "statement-piece"],
  "travel-vacation": ["vacation-style", "travel-outfit", "resort-wear"],
  "naming-ceremony": ["naming-ceremony", "family-event", "traditional-style"],
  "traditional-ceremony": ["traditional-style", "cultural-style", "aso-ebi"],

  // Fabric
  silk: ["silk-luxury", "premium-fabric", "smooth-finish"],
  cotton: ["cotton-wear", "casual-comfort", "easy-style"],
  linen: ["linen-style", "breathable-fabric", "summer-style"],
  denim: ["denim-wear", "casual-style", "jeans-fashion"],
  chiffon: ["chiffon-style", "lightweight", "flowy"],
  crepe: ["crepe-fabric", "draped-style", "elegant"],
  velvet: ["velvet-glam", "rich-textures", "luxury-style"],
  satin: ["satin-glam", "smooth-finish", "bridal"],
  organza: ["organza-fashion", "sheer-fabric", "formal-style"],

  // Color family
  black: ["black-fashion", "classic-black", "evening-wear"],
  white: ["white-fashion", "clean-style", "bridal"],
  neutral: ["neutral-palette", "minimalist-fashion", "understated"],
  red: ["red-style", "bold-color", "statement-piece"],
  blue: ["blue-style", "cool-tones", "everyday-style"],
  green: ["green-style", "earthy", "fresh-look"],
  yellow: ["yellow-style", "bright-color", "sunny-look"],
  pink: ["pink-style", "soft-glam", "feminine-style"],
  purple: ["purple-style", "royal-tones", "bold-style"],
  brown: ["brown-style", "earth-tones", "neutral-palette"],
  gold: ["gold-fashion", "metallic-glam", "luxury-style"],
  silver: ["silver-accents", "metallic-glam", "evening-wear"],
  multicolor: ["colorful", "vibrant-prints", "statement-color"],
  "earth-tones": ["earth-tones", "natural-colors", "warm-palette"],
  pastels: ["pastel-colors", "soft-tones", "light-hues"],

  // Fit
  slim: ["slim-fit", "tailored", "clean-lines"],
  regular: ["regular-fit", "easy-fit", "daily-wear"],
  loose: ["loose-fit", "relaxed-fit", "comfortable"],
  oversized: ["oversize-fashion", "big-fit", "street-style"],
  flowy: ["flowy-dress", "breezy", "soft-drape"],
  structured: ["structured-fit", "tailored", "sharp-lines"],
  fitted: ["fitted-style", "body-skimming", "tailored"],
  relaxed: ["relaxed-fit", "comfortable", "easy-style"],
};
