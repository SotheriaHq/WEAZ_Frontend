/**
 * Maps filter value slugs to suggested freeform tags.
 * When a designer selects a filter value, these tags are suggested
 * in the tag input for quick addition.
 */
export const FILTER_TAG_SUGGESTIONS: Record<string, string[]> = {
    // === Fabric Type ===
    'ankara': ['ankara-fashion', 'african-prints', 'bold-prints'],
    'aso-oke': ['aso-oke', 'traditional-yoruba', 'owambe'],
    'lace': ['lace-style', 'lacewear', 'elegant'],
    'adire': ['adire', 'tie-dye', 'indigenous-craft'],
    'cotton': ['cotton-wear', 'casual-comfort'],
    'silk': ['silk-luxury', 'premium-fabric'],
    'velvet': ['velvet-glam', 'rich-textures'],
    'kente': ['kente-cloth', 'ghanaian-fashion', 'woven-textiles'],
    'mud-cloth': ['mud-cloth', 'malian-fashion', 'artisan-craft'],
    'batik': ['batik-prints', 'hand-dyed', 'artisan'],
    'chiffon': ['chiffon-style', 'lightweight', 'flowy'],
    'denim': ['denim-wear', 'casual', 'jeans-fashion'],
    'organza': ['organza-fashion', 'sheer-fabric', 'formal'],
    'satin': ['satin-glam', 'smooth-finish', 'luxury'],

    // === Style ===
    'traditional-nigerian': ['yoruba-fashion', 'igbo-fashion', 'hausa-fashion', 'naija-style'],
    'afro-modern': ['afro-fusion', 'modern-african', 'contemporary'],
    'streetwear-style': ['street-style', 'urban-fashion', 'casual-cool'],
    'formal': ['office-wear', 'professional', 'corporate-style'],
    'wedding-style': ['bridal', 'aso-ebi', 'wedding-fashion'],
    'festival': ['owambe', 'eid-fashion', 'sallah-style', 'party-wear'],
    'minimalist': ['simple-elegance', 'clean-lines', 'understated'],
    'bold-prints': ['print-lover', 'statement-piece', 'vibrant'],
    'western-casual': ['western-style', 'casual-chic', 'modern'],
    'indian-fusion': ['indo-african', 'fusion-fashion', 'cross-cultural'],

    // === Occasion ===
    'everyday': ['daily-wear', 'casual', 'comfortable'],
    'work-office': ['office-style', 'work-outfit', 'corporate'],
    'party-night-out': ['party-dress', 'night-out', 'glamour'],
    'wedding-occasion': ['aso-ebi', 'bridal', 'wedding-guest'],
    'festival-eid-sallah-owambe': ['owambe-fashion', 'eid-outfit', 'sallah-style', 'festive'],
    'church': ['sunday-best', 'modest-fashion', 'church-outfit'],
    'graduation': ['grad-look', 'celebration', 'achievement'],
    'date-night': ['date-style', 'romantic', 'evening-wear'],

    // === Color Family ===
    'bold-print-colors': ['colorful', 'vibrant-prints', 'statement-color'],
    'earth-tones': ['earthy', 'natural-colors', 'warm-palette'],
    'pastels': ['pastel-colors', 'soft-tones', 'light-hues'],
    'monochrome': ['black-and-white', 'neutral', 'classic'],
    'metallic-gold-silver': ['gold-fashion', 'silver-accents', 'metallic-glam'],
    'neutrals': ['neutral-palette', 'beige', 'understated'],

    // === Fit / Shape ===
    'loose-flowy': ['flowy-dress', 'relaxed-fit', 'breezy'],
    'fitted': ['body-hugging', 'tailored', 'figure-flattering'],
    'oversized': ['oversize-fashion', 'baggy', 'big-fit'],
    'curvy-plus': ['plus-size', 'curvy-fashion', 'body-positive'],
    'petite': ['petite-fashion', 'small-frame', 'mini'],

    // === Designer Location ===
    'lagos': ['made-in-lagos', 'lagos-fashion', 'naija-made'],
    'abuja': ['abuja-fashion', 'fct-style'],
    'accra': ['made-in-ghana', 'accra-fashion'],
    'port-harcourt': ['ph-fashion', 'south-south-style'],
    'london': ['london-based', 'uk-african-fashion'],
    'online-only': ['digital-brand', 'online-fashion'],
};
