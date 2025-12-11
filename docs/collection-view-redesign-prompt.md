# Threadly Collection View Page - Premium Fashion Social Content Redesign Prompt

## 🎨 Design Vision

Create a **world-class, editorial-grade collection viewing experience** for Threadly - where African fashion meets social commerce. The page should feel like browsing a high-end fashion magazine digitally, with the interactivity of Instagram and the shopping convenience of a luxury e-commerce site.

**Design Philosophy:** "The Runway Meets The Feed"
- Every collection view should feel like a personal fashion show
- Media should breathe and command attention
- Social proof and engagement should feel organic, not forced
- The shopping journey should feel aspirational, not transactional

---

## 📱 Platform Context

**Threadly** is Africa's premier fashion social e-commerce platform. Collections are curated fashion stories uploaded by brands - multiple images/videos showcasing a cohesive fashion narrative (think: a lookbook, a drop, a season).

### Current Design System
```css
/* Colors */
--primary: #9333EA (Purple-600)
--primary-light: #A855F7 (Purple-500)
--accent-gradient: linear-gradient(135deg, #9333EA, #6366F1)
--bg-dark: #0f0f0f
--bg-light: #f9fafb

/* Glass Effects */
--glass-dark: rgba(15, 15, 15, 0.95) + backdrop-blur(24px)
--glass-light: rgba(255, 255, 255, 0.05) + backdrop-blur(16px)

/* Typography */
--font-body: 'Inter', sans-serif
--font-display: 'Playfair Display', serif

/* Currency */
Nigerian Naira (₦ NGN)
```

---

## 📋 Current Page Analysis

### What Exists Now:
1. **Back button** - Simple navigation
2. **Title bar** - Gradient text title + piece count badge
3. **3-column layout** (desktop):
   - Left (2/3): StackedCarousel with 3D cover-flow effect
   - Right (1/3): Metadata card + Comments panel
4. **StackedCarousel** - 3D perspective cards with:
   - Keyboard navigation (arrow keys)
   - Video autoplay on active
   - Cover image badge for owner
5. **CollectionMetadata** - Glass panel with:
   - Title, description, tags
   - Price range (with sale strike-through)
   - Stats (likes, comments, items, views)
   - Action buttons (like, share, add to cart)
   - Owner menu (edit, delete, discount)
6. **Comments section** - Unified comments panel with scrollable list

### Design Gaps Identified:
- ❌ No immersive full-bleed hero experience
- ❌ Media feels constrained, not celebrated
- ❌ Social engagement feels bolted-on, not integrated
- ❌ No storytelling elements (brand story, collection narrative)
- ❌ Shopping CTAs lack premium feel
- ❌ No visual hierarchy for browsing vs buying mindset
- ❌ Mobile experience needs vertical-first thinking
- ❌ No micro-interactions that delight

---

## 🚀 Design Requirements

### 1. Hero Section - "The Opening Shot"

The first impression should be breathtaking. The cover image should dominate.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌─ HERO IMAGE (Full Bleed) ────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │                                                                       │  │
│  │                      [Cover Image/Video]                              │  │
│  │                       Full viewport width                             │  │
│  │                       60-70vh height                                  │  │
│  │                       Object-fit: cover                               │  │
│  │                                                                       │  │
│  │  ┌──────────────────────────────────────────────────────────────┐    │  │
│  │  │  ← Back                                              [Share] │    │  │
│  │  └──────────────────────────────────────────────────────────────┘    │  │
│  │                                                                       │  │
│  │                                                                       │  │
│  │  ┌──────────────────────────────────────────────────────────────┐    │  │
│  │  │  BRAND LOGO/AVATAR                                           │    │  │
│  │  │  Summer Breeze '24                     ← Title (Playfair)    │    │  │
│  │  │  @brandname • 7 pieces                                       │    │  │
│  │  └──────────────────────────────────────────────────────────────┘    │  │
│  │                                                                       │  │
│  │                      [ Scroll to explore ↓ ]                          │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Design Specifications:**
- **Hero Image:** Full viewport width, 60-70vh height
- **Gradient Overlay:** Bottom gradient `linear-gradient(to top, rgba(0,0,0,0.8), transparent 60%)`
- **Floating Header:** Glass panel with back button + share icon
- **Title Treatment:**
  - Brand avatar (48px, rounded-full, border-2 border-white/20)
  - Collection title in Playfair Display, 3xl-4xl, white, slight text-shadow
  - Metadata line: @brandname • 7 pieces • Public/Private badge
- **Scroll indicator:** Animated chevron or "Explore" text at bottom

---

### 2. Media Gallery Section - "The Runway"

Transform from carousel to immersive vertical gallery with horizontal thumbnails.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌─ FEATURED MEDIA ─────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │     ┌─────────────────────────────────────────────────────────┐      │  │
│  │     │                                                         │      │  │
│  │     │                                                         │      │  │
│  │     │              [Selected Media - Large]                   │      │  │
│  │     │                                                         │      │  │
│  │     │              Natural aspect ratio                       │      │  │
│  │     │              Max-width: 800px                           │      │  │
│  │     │              Centered                                   │      │  │
│  │     │                                                         │      │  │
│  │     │                                                         │      │  │
│  │     │     ◀ [Nav]                           [Nav] ▶           │      │  │
│  │     └─────────────────────────────────────────────────────────┘      │  │
│  │                                                                       │  │
│  │     ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                │  │
│  │     │ 1  │ │ 2  │ │ 3  │ │ 4  │ │ 5  │ │ 6  │ │ 7  │  ← Thumbnails  │  │
│  │     │ ★  │ │    │ │ ▶  │ │    │ │    │ │    │ │    │    with cover  │  │
│  │     └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘    badge       │  │
│  │         ↑ Selected (purple ring)                                     │  │
│  │                                                                       │  │
│  │     [ 3 of 7 ]                                                       │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Design Specifications:**
- **Main Preview:** Centered, natural aspect ratio, max-width 800px
- **Background:** Subtle gradient or blur of current image
- **Navigation Arrows:** Glass circles at left/right edges, appear on hover
- **Thumbnail Strip:**
  - Horizontal scroll with momentum
  - 80×80px thumbnails, rounded-xl
  - Selected: Purple ring (box-shadow: 0 0 0 3px #9333EA)
  - Cover badge: Star icon in purple circle
  - Video badge: Play icon overlay
- **Counter:** "3 of 7" centered below thumbnails
- **Gestures:** Swipe on mobile, arrow keys on desktop, click thumbnails

---

### 3. Collection Story Section - "The Narrative"

Fashion is storytelling. Give brands space to share their vision.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌─ THE STORY ──────────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │     ┌─────────────────────────────────────────────────────────┐      │  │
│  │     │                                                         │      │  │
│  │     │  "Inspired by the warm coastal breeze of Lagos, this    │      │  │
│  │     │   collection brings together lightweight ankara prints  │      │  │
│  │     │   with modern silhouettes. Each piece is designed to    │      │  │
│  │     │   move with you, from beach to city..."                 │      │  │
│  │     │                                                         │      │  │
│  │     │   [Read more ▼]                                         │      │  │
│  │     │                                                         │      │  │
│  │     └─────────────────────────────────────────────────────────┘      │  │
│  │                                                                       │  │
│  │     ┌─────────────────────────────────────────────────────────┐      │  │
│  │     │  [african-print] [ankara] [summer] [lightweight]        │      │  │
│  │     │  [lagos-fashion] [resort-wear] [made-in-nigeria]        │      │  │
│  │     └─────────────────────────────────────────────────────────┘      │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Design Specifications:**
- **Description:** Serif font (Playfair Display) for elegance, italic styling
- **Max lines:** Show 3-4 lines initially, expand on "Read more"
- **Tags:** Pill badges, clickable (filter by tag)
  - Style: `bg-purple-500/10 text-purple-400 border border-purple-500/30`
  - Hover: Slightly brighter, pointer cursor

---

### 4. Shopping Section - "The Desire"

Make the purchase journey feel aspirational.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌─ PRICING & ACTIONS ──────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │     ┌─────────────────────────────────────────────────────────┐      │  │
│  │     │                                                         │      │  │
│  │     │  ₦15,000 - ₦45,000                    ← Regular Price   │      │  │
│  │     │  ₦12,000 - ₦38,000                    ← Sale Price      │      │  │
│  │     │                                       (strikethrough    │      │  │
│  │     │  ⏰ Sale ends in 2d 14h                original)         │      │  │
│  │     │  ████████████░░░░░░░░░░░░░░           Progress bar     │      │  │
│  │     │                                                         │      │  │
│  │     │  ┌───────────────────┐ ┌───────────────────┐           │      │  │
│  │     │  │  ❤ Add to        │ │  🛒 Add to Cart   │           │      │  │
│  │     │  │    Wishlist      │ │                   │           │      │  │
│  │     │  └───────────────────┘ └───────────────────┘           │      │  │
│  │     │                                                         │      │  │
│  │     │  [Contact Brand] [Visit Store 📍] [Share ↗]            │      │  │
│  │     │                                                         │      │  │
│  │     └─────────────────────────────────────────────────────────┘      │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Design Specifications:**
- **Regular Price:** `text-xl font-semibold text-white`
- **Sale Price:** `text-2xl font-bold text-green-400`
- **Original (crossed):** `text-lg text-gray-500 line-through`
- **Countdown Timer:**
  - Urgency colors: >24h = gray, <24h = yellow, <6h = orange, <1h = red pulse
  - Progress bar showing time remaining
- **Primary CTA:** "Add to Cart" - gradient purple button, large, shadow
- **Secondary CTA:** "Add to Wishlist" - outline button with heart icon
- **Tertiary Actions:** Contact, Visit Store (if available), Share

---

### 5. Social Proof Section - "The Community"

Engagement should feel like a conversation, not a comment section.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌─ COMMUNITY ──────────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │     ┌─ STATS BAR ────────────────────────────────────────────┐       │  │
│  │     │                                                         │       │  │
│  │     │   ❤ 234 likes   💬 45 comments   👁 1.2k views          │       │  │
│  │     │                                                         │       │  │
│  │     └─────────────────────────────────────────────────────────┘       │  │
│  │                                                                       │  │
│  │     ┌─ COMMENTS ─────────────────────────────────────────────┐       │  │
│  │     │                                                         │       │  │
│  │     │  ┌─────────────────────────────────────────────────┐   │       │  │
│  │     │  │ 👤 @fashionista • 2h ago                        │   │       │  │
│  │     │  │ "This collection is absolutely stunning! 😍       │   │       │  │
│  │     │  │  The ankara patterns are so vibrant."           │   │       │  │
│  │     │  │                                    ❤ 12  💬 3   │   │       │  │
│  │     │  └─────────────────────────────────────────────────┘   │       │  │
│  │     │                                                         │       │  │
│  │     │  ┌─────────────────────────────────────────────────┐   │       │  │
│  │     │  │ 👤 @styleicon • 5h ago                          │   │       │  │
│  │     │  │ "Can I get this in size M? 🙏"                  │   │       │  │
│  │     │  │                                    ❤ 5   💬 1   │   │       │  │
│  │     │  └─────────────────────────────────────────────────┘   │       │  │
│  │     │                                                         │       │  │
│  │     │  [View all 45 comments]                                │       │  │
│  │     │                                                         │       │  │
│  │     │  ┌─────────────────────────────────────────────────┐   │       │  │
│  │     │  │ 💬 Add a comment...                             │   │       │  │
│  │     │  └─────────────────────────────────────────────────┘   │       │  │
│  │     │                                                         │       │  │
│  │     └─────────────────────────────────────────────────────────┘       │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Design Specifications:**
- **Stats Bar:** Horizontal row with icons + numbers, subtle separators
- **Comment Cards:**
  - Avatar (32px), username, timestamp
  - Comment text with emoji support
  - Likes/replies count inline
  - Subtle hover state
- **Nested Replies:** Indented with connecting line
- **Input Field:** Sticky at bottom on mobile, inline on desktop
- **Load More:** "View all X comments" link
- **Real-time:** New comments slide in from bottom

---

### 6. Brand Section - "The Creator"

Spotlight the brand behind the collection.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌─ ABOUT THE BRAND ────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │     ┌─────────────────────────────────────────────────────────┐      │  │
│  │     │                                                         │      │  │
│  │     │  ┌────────┐                                            │      │  │
│  │     │  │        │  Ankara Dreams                              │      │  │
│  │     │  │  LOGO  │  @ankaradreams                             │      │  │
│  │     │  │        │  Lagos, Nigeria 🇳🇬                         │      │  │
│  │     │  └────────┘                                            │      │  │
│  │     │                                                         │      │  │
│  │     │  "Celebrating African heritage through contemporary    │      │  │
│  │     │   fashion. Every piece tells a story."                 │      │  │
│  │     │                                                         │      │  │
│  │     │  ┌─────────────────┐ ┌──────────────────┐              │      │  │
│  │     │  │ 📦 45 Collections │ │ 👥 12.4k Followers │              │      │  │
│  │     │  └─────────────────┘ └──────────────────┘              │      │  │
│  │     │                                                         │      │  │
│  │     │        [ Follow ]  [ View Profile → ]                   │      │  │
│  │     │                                                         │      │  │
│  │     └─────────────────────────────────────────────────────────┘      │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Design Specifications:**
- **Brand Card:** Glass panel with brand avatar, name, handle, location
- **Bio:** Short brand description
- **Stats:** Collection count, follower count
- **Actions:** Follow button (toggle state), View Profile link
- **Verified Badge:** If applicable, show checkmark

---

### 7. Related Collections - "More to Explore"

Keep users in the discovery loop.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌─ MORE FROM ANKARA DREAMS ────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │     ← [Scroll] →                                                      │  │
│  │                                                                       │  │
│  │     ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐      │  │
│  │     │        │  │        │  │        │  │        │  │        │      │  │
│  │     │  Img   │  │  Img   │  │  Img   │  │  Img   │  │  Img   │      │  │
│  │     │        │  │        │  │        │  │        │  │        │      │  │
│  │     ├────────┤  ├────────┤  ├────────┤  ├────────┤  ├────────┤      │  │
│  │     │ Title  │  │ Title  │  │ Title  │  │ Title  │  │ Title  │      │  │
│  │     │ ₦12k-  │  │ ₦8k-   │  │ ₦25k-  │  │ ₦15k-  │  │ ₦10k-  │      │  │
│  │     │ ₦35k   │  │ ₦22k   │  │ ₦55k   │  │ ₦40k   │  │ ₦28k   │      │  │
│  │     └────────┘  └────────┘  └────────┘  └────────┘  └────────┘      │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ YOU MIGHT ALSO LIKE ────────────────────────────────────────────────┐  │
│  │     (Similar collections from other brands)                          │  │
│  │     ...                                                               │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Design Specifications:**
- **Horizontal Scroll:** Cards scroll horizontally with snap points
- **Card Design:** Cover image, title, price range
- **Two Sections:**
  1. More from this brand
  2. Similar collections (algorithm-based)
- **Hover Effect:** Slight scale, show quick-view icon

---

## 📱 Mobile Layout (Vertical-First)

```
┌─────────────────────┐
│ [← Back]    [Share] │  ← Floating header
├─────────────────────┤
│                     │
│   [Hero Image]      │  60vh, full bleed
│                     │
│   Summer Breeze '24 │
│   @ankaradreams     │
│                     │
├─────────────────────┤
│                     │
│  [Featured Media]   │  Full width
│                     │
│  ○ ○ ● ○ ○ ○ ○      │  ← Dot indicators
│                     │
│  [1] [2] [3] [4]... │  ← Thumbnails strip
│                     │
├─────────────────────┤
│                     │
│  ₦15,000 - ₦45,000  │
│                     │
│  [ 🛒 Add to Cart ] │  ← Full width CTA
│  [ ❤ Wishlist ]     │
│                     │
├─────────────────────┤
│                     │
│  "Inspired by..."   │  ← Description
│  [Read more]        │
│                     │
│  [tag] [tag] [tag]  │
│                     │
├─────────────────────┤
│                     │
│  ❤ 234  💬 45  👁1.2k│  ← Stats row
│                     │
│  ┌─────────────────┐│
│  │ Comment 1       ││
│  │ Comment 2       ││
│  │ Comment 3       ││
│  │ [View all 45]   ││
│  └─────────────────┘│
│                     │
├─────────────────────┤
│ [💬 Add comment...] │  ← Sticky input
└─────────────────────┘
```

---

## 🎭 Animations & Micro-interactions

### 1. Page Load
- Hero image fades in with subtle zoom (scale 1.05 → 1)
- Title slides up from bottom with stagger
- Stats count up from 0

### 2. Media Navigation
- Cross-fade between images (300ms)
- Thumbnail selection: scale bounce + ring appears
- Swipe momentum with rubber-band at edges

### 3. Like Animation
- Heart fills with particles burst
- Number increments with spring animation

### 4. Add to Cart
- Button morphs briefly to checkmark
- Subtle pulse on cart icon in header
- Toast slides in from bottom

### 5. Comments
- New comments slide in from bottom
- Reply indent animates
- Like heart has micro-bounce

### 6. Scroll Effects
- Hero parallax (subtle, 0.3x speed)
- Sections fade in on scroll (stagger)
- Sticky elements smooth transition

---

## 🎨 Color Tokens

```css
/* Primary Actions */
--cta-gradient: linear-gradient(135deg, #9333EA, #6366F1);
--cta-shadow: 0 4px 14px rgba(147, 51, 234, 0.25);

/* Sale/Urgency */
--sale-badge: #22C55E (green-500);
--urgency-low: #6B7280 (gray-500);
--urgency-medium: #F59E0B (amber-500);
--urgency-high: #F97316 (orange-500);
--urgency-critical: #EF4444 (red-500);

/* Social Engagement */
--like-heart: #EF4444 (red-500);
--comment-icon: #6366F1 (indigo-500);

/* Glass Panels */
--glass-bg: rgba(255, 255, 255, 0.05);
--glass-border: rgba(255, 255, 255, 0.1);
--glass-blur: 24px;
```

---

## ✅ Acceptance Criteria

1. **Hero Experience**
   - [ ] Full-bleed cover image with gradient overlay
   - [ ] Brand info and title prominent
   - [ ] Scroll indicator visible

2. **Media Gallery**
   - [ ] Smooth transitions between media
   - [ ] Thumbnail strip with selection state
   - [ ] Video autoplay when selected
   - [ ] Mobile swipe gestures work

3. **Shopping Flow**
   - [ ] Price clearly visible with sale treatment
   - [ ] Add to Cart is prominent
   - [ ] Wishlist is accessible
   - [ ] Sale countdown is accurate

4. **Social Engagement**
   - [ ] Like/unlike works with animation
   - [ ] Comments load and submit
   - [ ] Share works (native or clipboard)

5. **Performance**
   - [ ] Lazy load images below fold
   - [ ] Optimized for 3G connections
   - [ ] No layout shift (CLS < 0.1)

6. **Accessibility**
   - [ ] Keyboard navigation throughout
   - [ ] Screen reader labels
   - [ ] Color contrast meets WCAG AA

---

## 🔗 References

- **Pinterest:** Full-bleed imagery, clean typography
- **Net-a-Porter:** Luxury e-commerce, editorial feel
- **Instagram:** Social engagement patterns
- **Ssense:** Fashion-forward product pages
- **Vogue Runway:** Editorial photography showcase

---

*This prompt should guide the creation of a world-class collection viewing experience that celebrates African fashion while driving engagement and conversion.*
