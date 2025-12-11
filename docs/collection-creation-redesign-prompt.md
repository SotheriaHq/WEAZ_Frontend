# Threadly Collection Creation Page - UI/UX Redesign Prompt

## 🎨 Design Brief

Create a **premium, immersive collection creation experience** for Threadly - an African fashion social e-commerce platform. The design should feel like a creative studio where fashion brands craft their stories, not just a form submission page.

---

## 📱 Platform Context

**Threadly** is a social e-commerce platform celebrating African fashion heritage. Brands upload "Collections" - curated sets of fashion imagery with metadata that appear in the design feed (similar to Pinterest meets Instagram for fashion).

### Design System Constants
- **Primary Color**: Purple (#9333EA)
- **Background (Dark)**: #0f0f0f / gray-950
- **Background (Light)**: White with soft gray accents
- **Glass Effect**: `bg-white/95 dark:bg-gray-950/95 backdrop-blur-2xl`
- **Gradient Blur Backdrop**: `from-purple-900/40 via-indigo-900/50 to-blue-900/40`
- **Border Radius**: `rounded-2xl` for cards, `rounded-xl` for buttons
- **Currency**: Nigerian Naira (₦ NGN)
- **Typography**: Inter (body), Playfair Display (serif accents)

---

## 📋 Current System Features (Must Preserve)

### Media Upload System
1. **Multi-file upload** (up to 20 images/videos)
2. **Drag & drop zone** with visual feedback
3. **Image aspect ratio preservation** - each image displays at its natural proportions
4. **Thumbnail strip** - horizontal scrollable thumbnails below main preview
5. **Main preview area** - shows selected image at full size (500px height container)
6. **Delete functionality** - X button on each thumbnail
7. **Add more button** - ability to add additional files after initial upload
8. **Upload progress** - per-file progress indicators during upload
9. **Video support** - thumbnail shows play icon overlay

### Form Fields (Segmented Data Collection)
**Section 1: Basics**
- Collection Title (required)
- Description (textarea)
- Category dropdown (fetched from API)
- Tags (TagPicker with suggestions, max 10, allow custom)

**Section 2: Advanced**
- Min Price / Max Price (₦)
- Available in physical store (toggle)
- Type: Everybody / Male / Female
- Visibility: Public / Private
- Collaborators search (placeholder for future feature)

### Actions
- **Save to Draft** - saves collection without publishing
- **Create/Update Collection** - publishes to feed
- **Edit Mode** - same form pre-populated for existing collections

---

## 🚀 Design Requirements

### 1. Overall Layout Philosophy

Transform the current two-column wizard layout into a **storytelling canvas**:

```
┌─────────────────────────────────────────────────────────────┐
│  [← Back]              CREATE YOUR STORY              [?]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │              MAIN MEDIA CANVAS                      │   │
│  │         (Hero image/video display)                  │   │
│  │         Aspect ratio preserved                      │   │
│  │         Min height: 400px, Max: 600px               │   │
│  │                                                     │   │
│  │  [Delete] [Set as Cover] [Reorder] [Fullscreen]    │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌─────────┐   │
│  │ 1 │ │ 2 │ │ 3 │ │ 4 │ │ 5 │ │ 6 │ │ 7 │ │  + Add  │   │
│  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └─────────┘   │
│   ↑ Draggable thumbnail strip with reorder                  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📝 COLLECTION DETAILS                              │   │
│  │                                                     │   │
│  │  Title: [________________________]                  │   │
│  │                                                     │   │
│  │  Description:                                       │   │
│  │  [______________________________________________]   │   │
│  │  [______________________________________________]   │   │
│  │                                                     │   │
│  │  Category: [▼ Select category]                      │   │
│  │                                                     │   │
│  │  🏷️ Tags: [african-print] [ankara] [summer] [+]    │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  💰 PRICING & AVAILABILITY                          │   │
│  │                                                     │   │
│  │  Price Range: [₦ Min] ━━●━━ [₦ Max]                │   │
│  │                                                     │   │
│  │  [●] Available in physical store                    │   │
│  │  [ ] Made to order                                  │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🎯 TARGETING & VISIBILITY                          │   │
│  │                                                     │   │
│  │  Audience: [●Everybody] [○Men] [○Women]            │   │
│  │                                                     │   │
│  │  Visibility: [●Public] [○Private] [○Subscribers]   │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│       [ 📄 Save Draft ]         [ ✨ Publish Collection ]   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2. Media Upload Zone (Empty State)

When no files are uploaded, show an **inspiring upload zone**:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    ┌──────────────────┐                     │
│                    │                  │                     │
│                    │   ✨ 📸 ✨       │                     │
│                    │                  │                     │
│                    └──────────────────┘                     │
│                                                             │
│              Drag & drop your fashion imagery               │
│                                                             │
│           or click to browse from your device               │
│                                                             │
│    ┌─────────┐    ┌─────────┐    ┌─────────┐              │
│    │  JPG    │    │  PNG    │    │  MP4    │              │
│    │  JPEG   │    │  WEBP   │    │  MOV    │              │
│    └─────────┘    └─────────┘    └─────────┘              │
│                                                             │
│                   Up to 20 files                            │
│              Images & videos supported                      │
│                                                             │
│           [ 🎨 Browse Gallery ]  [ 📱 Take Photo ]         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Design Notes:**
- Dashed border animation on drag hover
- Purple glow effect when files are dragged over
- Gradient background: subtle purple → indigo radial gradient
- Supported formats displayed as minimal badges
- Mobile: Show camera option

### 3. Thumbnail Strip Design

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌───────┐   │
│  │ ★ 1│  │   2 │  │   3 │  │   4 │  │   5 │  │  + Add │   │
│  │     │  │     │  │ ▶️  │  │     │  │     │  │ More   │   │
│  │ 🔵  │  │     │  │     │  │     │  │ ⏳  │  │        │   │
│  │ ✕   │  │ ✕   │  │ ✕   │  │ ✕   │  │ 45% │  │        │   │
│  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘  └───────┘   │
│     ↑         ↑         ↑                ↑                  │
│  Cover    Selected   Video          Uploading               │
│  (Star)   (Blue dot) (Play)         (Progress)              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- **Cover indicator**: Gold star badge on first/cover image
- **Selection indicator**: Purple ring around selected thumbnail
- **Video indicator**: Play icon overlay
- **Upload progress**: Circular progress ring around thumbnail
- **Delete button**: X button appears on hover (desktop) or always visible (mobile)
- **Drag handle**: ≡ icon for reordering (drag to reposition)
- **Aspect ratio**: Thumbnails maintain square crop (80×80px or 100×100px)
- **Scrollable**: Horizontal scroll with momentum, hide scrollbar

### 4. Main Preview Canvas

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │                                                     │   │
│  │                                                     │   │
│  │              [Image/Video Content]                  │   │
│  │                                                     │   │
│  │              Preserves aspect ratio                 │   │
│  │              object-fit: contain                    │   │
│  │                                                     │   │
│  │                                                     │   │
│  │                                                     │   │
│  │  ┌──────────────────────────────────────────────┐  │   │
│  │  │ 🗑️ Delete │ ⭐ Set Cover │ ↔️ Move │ ⛶ Full │  │   │
│  │  └──────────────────────────────────────────────┘  │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Image 3 of 7  •  fashion-shoot-01.jpg  •  2.4 MB          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Interactions:**
- Click left/right edges to navigate (arrow overlays on hover)
- Keyboard: Arrow keys to navigate
- Swipe on mobile
- Double-tap/click for fullscreen
- Floating action bar at bottom of preview (glass panel)

### 5. Form Sections Design

Use **expandable cards** with clear visual hierarchy:

```
┌─────────────────────────────────────────────────────────────┐
│  📝 Collection Details                              [−/+]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Collection Title *                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Summer Breeze '24                                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Tell Your Story                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Inspired by the warm coastal breeze of Lagos...      │   │
│  │ This collection features lightweight ankara prints   │   │
│  │ perfect for the summer season.                       │   │
│  │                                                      │   │
│  │ _________________________________ 234/500 characters │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Category                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 👗 Dresses & Gowns                               ▼ │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Tags (up to 10)                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [african-print ✕] [ankara ✕] [summer ✕] [lagos ✕]   │   │
│  │                                                      │   │
│  │ [+ Add tag...]                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Suggested: [adire] [kente] [wedding] [casual] [formal]    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6. Tag Input Component

```
┌─────────────────────────────────────────────────────────────┐
│  🏷️ Tags                                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Selected Tags (4/10):                                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ [african-print ✕] [ankara ✕] [summer ✕] [lagos ✕]    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 🔍 Search or create a tag...                         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  Popular Tags:                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ [adire] [kente] [wedding] [casual] [traditional]     │  │
│  │ [formal] [aso-oke] [batik] [tie-dye] [resort-wear]   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Tag Badge Styles:**
- Selected: Purple filled badge with white text
- Suggested: Gray outline badge, hover turns purple
- Animate: Scale up on selection, fade out on removal

### 7. Pricing Section

```
┌─────────────────────────────────────────────────────────────┐
│  💰 Pricing & Availability                          [−/+]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Price Range                                                │
│  ┌────────────────────────┐    ┌────────────────────────┐  │
│  │ ₦ 15,000              │ ━━ │ ₦ 45,000              │  │
│  │ Minimum Price          │    │ Maximum Price          │  │
│  └────────────────────────┘    └────────────────────────┘  │
│                                                             │
│  💡 Tip: Setting a price range helps buyers know what to   │
│     expect. Leave empty if prices vary significantly.       │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ [●] Available in Physical Store                      │  │
│  │     ↳ Show "Visit Store" option on collection        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ [ ] Made to Order                                    │  │
│  │     ↳ Show "Custom Order" badge on collection        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 8. Targeting & Visibility Section

```
┌─────────────────────────────────────────────────────────────┐
│  🎯 Targeting & Visibility                          [−/+]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Target Audience                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [● Everybody] [○ Men] [○ Women]                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Who Can See This?                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │  [●] 🌍 Public                                      │   │
│  │      Everyone can see this collection                │   │
│  │                                                      │   │
│  │  [○] 🔒 Private                                     │   │
│  │      Only you and collaborators can see              │   │
│  │                                                      │   │
│  │  [○] ⭐ Subscribers Only                            │   │
│  │      Only your subscribers can view                  │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 9. Action Buttons (Footer)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌───────────────────┐    ┌───────────────────────────┐    │
│  │   📄 Save Draft   │    │  ✨ Publish Collection    │    │
│  │                   │    │                           │    │
│  │   (Secondary)     │    │  (Primary - Gradient)     │    │
│  └───────────────────┘    └───────────────────────────┘    │
│                                                             │
│              Collection saved locally • Last edit: 2m ago   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Button States:**
- **Disabled**: Gray, opacity 50%, no hover effect
- **Loading**: Show spinner, "Publishing..." / "Saving..."
- **Success**: Green checkmark animation, then redirect
- **Error**: Shake animation, red glow

### 10. Upload Progress State

During upload, show an immersive progress view:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    ┌──────────────────┐                     │
│                    │                  │                     │
│                    │   Uploading...   │                     │
│                    │                  │                     │
│                    │   ████████░░░░   │                     │
│                    │      67%         │                     │
│                    │                  │                     │
│                    └──────────────────┘                     │
│                                                             │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐               │
│  │ ✓ │ │ ✓ │ │ ✓ │ │ ✓ │ │ ⏳│ │ ○ │ │ ○ │               │
│  │100│ │100│ │100│ │100│ │45%│ │   │ │   │               │
│  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘               │
│                                                             │
│  Uploading: fashion-shoot-05.jpg                            │
│  5 of 7 files complete                                      │
│                                                             │
│                    [ Cancel Upload ]                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎭 Micro-interactions & Animations

### 1. File Drop Animation
- Border changes to dashed purple on drag enter
- Scale up slightly (1.02x)
- Purple glow pulse effect
- Files animate in with stagger delay (50ms each)

### 2. Thumbnail Selection
- Selected thumbnail: `scale-105`, purple ring, slight elevation
- Smooth transition: 200ms ease-out

### 3. Tag Addition
- Scale from 0 → 1 with bounce easing
- Slight shake when max tags reached
- Pulse effect when tag clicked

### 4. Form Validation
- Inline validation messages slide in from bottom
- Required fields have subtle red border on empty + submit attempt
- Success state: Green checkmark fade in

### 5. Upload Progress
- Circular progress around thumbnails
- Checkmark replaces progress on complete
- Confetti burst on all uploads complete

### 6. Section Expand/Collapse
- Height animate with spring physics
- Chevron rotates 180°
- Content fades in after height animation

---

## 📱 Mobile Responsive Design

### Mobile Layout (< 768px)
```
┌─────────────────────────────────┐
│ ← Create Collection             │
├─────────────────────────────────┤
│                                 │
│  ┌───────────────────────────┐  │
│  │                           │  │
│  │    [Main Image/Video]     │  │
│  │                           │  │
│  └───────────────────────────┘  │
│                                 │
│  [1][2][3][4][5][+]            │
│  ← Thumbnail strip (swipeable) │
│                                 │
├─────────────────────────────────┤
│                                 │
│  📝 Details                [▼]  │
│  ─────────────────────────────  │
│  Title: [....................]  │
│  Description: [...............]  │
│  Category: [▼ Dresses........]  │
│  Tags: [tag1] [tag2] [+Add]     │
│                                 │
│  💰 Pricing               [▼]  │
│  ─────────────────────────────  │
│  Min: ₦[....] Max: ₦[....]     │
│  [✓] Physical Store            │
│                                 │
│  🎯 Visibility            [▼]  │
│  ─────────────────────────────  │
│  (●) Public  (○) Private        │
│                                 │
├─────────────────────────────────┤
│                                 │
│  [Save Draft] [Publish ✨]      │
│                                 │
└─────────────────────────────────┘
```

---

## 📱 Screen-by-Screen AI Prompts

Since the AI can only create one screen at a time, here are **individual prompts** for each screen state. Each prompt is self-contained with full context.

**Note:** Screen 1 (Empty Upload State) is already covered by the main design above. Below are the additional screen states needed.

---

### 🖼️ SCREEN 2: Media Preview State (Content Uploaded & Form Filled)

**Prompt for AI:**

> Create the **Collection Creation page** for Threadly showing the state after the user has **uploaded images/videos and filled in form data**. This is what the page looks like when ready for submission.
>
> **Page Title:** "CREATE YOUR STORY" (Playfair Display font, gradient text: purple-400 → indigo-400 → blue-400)
>
> **Header:**
> - Sticky glass panel (`background: rgba(15, 15, 15, 0.95); backdrop-filter: blur(24px); border-bottom: 1px solid rgba(255,255,255,0.1)`)
> - Left: "← Back" button (gray-400 text, hover white)
> - Center: Page title with gradient text
> - Right: Help "?" icon button (glass-light rounded-xl, 36×36px)
>
> ---
>
> **MEDIA PREVIEW SECTION:**
>
> **Main Preview Canvas:**
> - Rounded-2xl container with glass-light background and border-white/10
> - Inner preview area: dark background (bg-black/50), min-height 400px, max-height 600px
> - Display a fashion image with `object-fit: contain` (preserve aspect ratio)
> - **Floating Action Bar** at bottom inside preview:
>   - Glass panel (`rgba(15, 15, 15, 0.95)`) with border-t border-white/10
>   - Four buttons horizontally centered (all glass-light rounded-xl with white text):
>     - "Delete" with trash icon
>     - "Set as Cover" with star icon
>     - "Reorder" with arrows icon
>     - "Fullscreen" with expand icon
>
> **Thumbnail Strip (Below Main Preview):**
> - Horizontal scrollable row with hidden scrollbar (scrollbar-hide)
> - Gap: 8px between thumbnails
> - Each thumbnail: 80×80px (mobile) or 96×96px (desktop), rounded-xl, object-cover
> - Show 5-6 thumbnails with different states:
>   1. **First thumbnail (Selected + Cover):** Purple ring border (box-shadow: 0 0 0 3px #9333EA), small purple circle badge with white star icon at top-left
>   2. **Second thumbnail:** Normal state (border-2 border-white/10, hover border-purple-500/50)
>   3. **Third thumbnail (Video):** White play icon overlay centered on semi-transparent black background
>   4. **Fourth thumbnail:** Normal state
>   5. **Fifth thumbnail (Uploading):** Semi-transparent image with circular purple progress spinner overlay showing "45%" in center
>   6. **Add More button:** Dashed border glass-light card (same size), + icon and "Add More" text (gray-400)
> - Delete button on each thumbnail: Small X button (24×24px, bg-black/70, rounded-full) at top-right corner
>
> **Image Info Bar:**
> - Below thumbnails, centered text: "Image 1 of 5 • fashion-shoot-01.jpg • 2.4 MB" (text-sm, gray-400)
>
> ---
>
> **FORM SECTIONS (All Expanded with Sample Data):**
>
> **Section 1: Collection Details** (rounded-2xl glass-panel border-white/10)
> - Header: Gradient purple icon (edit/pencil) in 40×40px rounded-xl container + "Collection Details" (text-lg font-semibold white) + chevron-down icon
> - **Collection Title:** Input with value "Summer Breeze '24" (required asterisk in red-400)
> - **Tell Your Story:** Textarea with placeholder text "Inspired by the warm coastal breeze of Lagos..." + character counter "0 / 500 characters" (text-xs gray-500, right-aligned)
> - **Category:** Dropdown showing "Select a category" with chevron icon (options include emoji like 👗 Dresses & Gowns)
> - **Tags Section:**
>   - Label: "🏷️ Tags (up to 10)" (text-sm gray-300)
>   - Container with glass-light background, rounded-xl, padding
>   - Selected tags row: Four purple filled badges with X button: [african-print ✕] [ankara ✕] [summer ✕] [lagos ✕]
>   - Search input: "🔍 Search or create a tag..." (glass-light bg-white/5 border-white/10)
>   - Popular Tags label: "Popular Tags:" (text-xs gray-400)
>   - Popular tags row: Outline badges (border-white/20, gray-300 text, hover turns purple): [adire] [kente] [wedding] [casual] [traditional] [formal] [aso-oke] [batik]
>
> **Section 2: Pricing & Availability** (same card style)
> - Header: Gradient icon (dollar/currency) + "Pricing & Availability" + chevron
> - **Price Range:**
>   - Label: "Price Range" (text-sm gray-300)
>   - Two side-by-side inputs with ₦ prefix (absolute positioned, gray-400):
>     - "Minimum Price" label above, value "15,000"
>     - "Maximum Price" label above, value "45,000"
>   - Info box below (bg-blue-500/10 border-blue-500/20 rounded-xl p-3):
>     - Blue info icon (20×20) + text: "Setting a price range helps buyers know what to expect. Leave empty if prices vary significantly." (text-sm blue-300)
> - **Checkboxes** (each in glass-light p-4 rounded-xl border-white/10):
>   - "Available in Physical Store" with checkbox + subtext "Show 'Visit Store' option on collection"
>   - "Made to Order" with checkbox + subtext "Show 'Custom Order' badge on collection"
>
> **Section 3: Targeting & Visibility** (same card style)
> - Header: Gradient icon (eye) + "Targeting & Visibility" + chevron
> - **Target Audience:**
>   - Label: "Target Audience" (text-sm gray-300)
>   - Three pill buttons in a row (flex, gap-3):
>     - "Everybody" - SELECTED (border-2 border-purple-500 bg-purple-500/10 text-purple-400)
>     - "Men" - unselected (border-2 border-white/10 text-gray-300 hover:border-white/20)
>     - "Women" - unselected
> - **Who Can See This?:**
>   - Label: "Who Can See This?" (text-sm gray-300)
>   - Three radio card options (glass-light border-2 p-4 rounded-xl):
>     - "🌍 Public" - SELECTED (border-purple-500 bg-purple-500/10) + subtext "Everyone can see this collection"
>     - "🔒 Private" - unselected (border-white/10) + subtext "Only you and collaborators can see"
>     - "⭐ Subscribers Only" - unselected + subtext "Only your subscribers can view"
>
> ---
>
> **STICKY FOOTER:**
> - Glass panel (`rgba(15, 15, 15, 0.95)`) with border-t border-white/10
> - Sticky to bottom, full width with padding
> - Left side: "Collection saved locally • Last edit: 2m ago" (text-sm gray-400)
> - Right side (flex gap-3):
>   - "Save Draft" button: glass-light border-white/10, document icon, white text
>   - "Publish Collection" button: gradient purple→indigo, sparkle/star icon, white text, shadow-lg shadow-purple-500/25
>
> ---
>
> **Styling Summary:**
> - Background: bg-gray-950 (#0f0f0f)
> - Glass panel: `rgba(15, 15, 15, 0.95)` + `backdrop-filter: blur(24px)`
> - Glass-light: `rgba(255, 255, 255, 0.05)` + `backdrop-filter: blur(16px)`
> - Gradient buttons: `linear-gradient(135deg, #9333EA, #6366F1)`
> - Border radius: rounded-2xl for cards, rounded-xl for inputs/buttons
> - Font: Inter for body, Playfair Display for page title only

---

### 🖼️ SCREEN 3: Pre-Publish Confirmation Modal

**Prompt for AI:**

> Create a **Pre-Publish Confirmation Modal** for Threadly's Collection Creation page. This modal appears when the user clicks "Publish Collection" - it shows a summary of their collection before final submission.
>
> **Background Overlay:**
> - Fixed position, full viewport
> - Background: gradient blur backdrop (`linear-gradient(135deg, rgba(147,51,234,0.4), rgba(99,102,241,0.5), rgba(59,130,246,0.4))`)
> - Additional layer: `backdrop-filter: blur(20px)` + `bg-black/40`
>
> **Modal Container:**
> - Centered in viewport (max-width: 600px, max-height: 90vh)
> - Glass panel: `rgba(15, 15, 15, 0.95)` with `backdrop-filter: blur(24px)`
> - Border: 1px solid rgba(255,255,255,0.1)
> - Border radius: rounded-3xl
> - Padding: 24px (p-6)
> - Overflow-y: auto with glass-scrollbar (purple gradient scrollbar)
>
> **Modal Header:**
> - Close button (X): Absolute top-right (top-4 right-4), glass-light rounded-full, 36×36px
> - Title: "Review Your Collection" (text-2xl font-bold, Playfair Display, white)
> - Subtitle: "Please review before publishing" (text-sm gray-400, mt-1)
>
> **Preview Section:**
> - Cover image preview: 100% width, aspect-ratio 16/9, rounded-2xl, object-cover
> - Small badge on image: "Cover Image" (absolute top-3 left-3, bg-purple-600 text-white text-xs px-2 py-1 rounded-full)
> - Media count badge: "7 images • 1 video" (absolute bottom-3 right-3, glass-light px-3 py-1 rounded-full text-sm)
>
> **Summary Details (Below Image):**
> - Glass-light container (rounded-xl, p-4, mt-4)
> - Grid layout (2 columns on desktop, 1 on mobile):
>
> | Label | Value |
> |-------|-------|
> | **Title** | Summer Breeze '24 |
> | **Category** | 👗 Dresses & Gowns |
> | **Price Range** | ₦15,000 - ₦45,000 |
> | **Target Audience** | Everybody |
> | **Visibility** | 🌍 Public |
> | **Tags** | african-print, ankara, summer, lagos |
>
> - Labels: text-xs text-gray-500 uppercase tracking-wide
> - Values: text-sm text-white font-medium
> - Tags should display as small purple badges inline
>
> **Options Summary (if applicable):**
> - Row showing badges for enabled options:
>   - If "Available in Physical Store" checked: Badge "🏪 Physical Store"
>   - If "Made to Order" checked: Badge "✂️ Made to Order"
> - Badges: glass-light border-white/10 px-3 py-1 rounded-full text-sm
>
> **Description Preview (Expandable):**
> - Label: "Description" (text-xs gray-500)
> - Content: First 100 characters + "..." + "Read more" link (text-purple-400)
> - If clicked, expands to show full description
>
> **Warning/Info Box (Optional):**
> - If any validation warnings, show:
>   - Yellow/amber info box: "💡 Tip: Adding more tags can help your collection get discovered"
>   - bg-amber-500/10 border-amber-500/20 text-amber-300
>
> **Action Buttons (Footer of Modal):**
> - Sticky to bottom of modal
> - Two buttons (flex, gap-3, w-full):
>   - "← Edit Collection" (flex-1, glass-light border-white/10, white text)
>   - "✨ Publish Now" (flex-1, gradient purple→indigo, white text, shadow-lg shadow-purple-500/25)
>
> **Loading State (After Click Publish):**
> - Replace content with:
>   - Large purple spinner (48×48px) centered
>   - Text: "Publishing your collection..." (text-lg white)
>   - Subtext: "This may take a moment" (text-sm gray-400)
>   - Progress dots animation (three dots pulsing)
>
> **Success State:**
> - Replace content with:
>   - Large green checkmark icon in gradient green circle (animated scale-in)
>   - Title: "Your Collection is Live! 🎉" (Playfair Display, white)
>   - Subtext: "Summer Breeze '24 has been published"
>   - Two buttons:
>     - "View Collection" (gradient purple, primary)
>     - "Create Another" (glass-light, secondary)
>   - Auto-redirect note: "Redirecting in 5s..." (text-xs gray-500)
>
> **Styling:**
> - Same design system as main page
> - Modal animation: Scale from 0.95 to 1, opacity 0 to 1 (200ms ease-out)
> - Backdrop animation: Opacity 0 to 1 (150ms)

---

## 🌓 Light Theme Design Specification

The design system must support **both dark and light themes**. Here's the complete mapping:

### Dark Theme (Default)
```css
/* Base */
body { background: #0f0f0f; color: #ffffff; }

/* Glass Panels */
.glass-panel {
    background: rgba(15, 15, 15, 0.95);
    backdrop-filter: blur(24px);
    border: 1px solid rgba(255, 255, 255, 0.1);
}
.glass-light {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(16px);
}

/* Inputs */
input, textarea, select {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #ffffff;
}
input::placeholder { color: #71717a; }

/* Text */
.text-primary { color: #ffffff; }
.text-secondary { color: #a1a1aa; }
.text-muted { color: #71717a; }
```

### Light Theme
```css
/* Base */
body { background: #f9fafb; color: #111827; }

/* Glass Panels */
.glass-panel {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(24px);
    border: 1px solid rgba(0, 0, 0, 0.08);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
.glass-light {
    background: rgba(0, 0, 0, 0.03);
    backdrop-filter: blur(16px);
}

/* Inputs */
input, textarea, select {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    color: #111827;
}
input::placeholder { color: #9ca3af; }

/* Text */
.text-primary { color: #111827; }
.text-secondary { color: #4b5563; }
.text-muted { color: #9ca3af; }

/* Upload Zone */
.upload-zone {
    border: 2px dashed #d1d5db;
    background: linear-gradient(135deg, rgba(147,51,234,0.05), rgba(99,102,241,0.08), rgba(59,130,246,0.05));
}
.upload-zone:hover {
    border-color: rgba(147, 51, 234, 0.5);
}

/* Tags */
.tag-selected {
    background: #9333EA;
    color: #ffffff;
}
.tag-suggested {
    background: transparent;
    border: 1px solid #d1d5db;
    color: #4b5563;
}
.tag-suggested:hover {
    border-color: #9333EA;
    color: #9333EA;
}

/* Radio/Checkbox Cards */
.option-card {
    background: #ffffff;
    border: 2px solid #e5e7eb;
}
.option-card:hover {
    border-color: rgba(147, 51, 234, 0.3);
}
.option-card.selected {
    border-color: #9333EA;
    background: rgba(147, 51, 234, 0.05);
}
```

### Shared (Both Themes)
```css
/* Purple Accents - Same in both themes */
.gradient-primary {
    background: linear-gradient(135deg, #9333EA, #6366F1);
}
.btn-primary {
    background: linear-gradient(135deg, #9333EA, #6366F1);
    color: #ffffff;
    box-shadow: 0 4px 14px rgba(147, 51, 234, 0.25);
}
.btn-primary:hover {
    opacity: 0.9;
}

/* Title Gradient - Same in both */
.title-gradient {
    background: linear-gradient(to right, #a855f7, #818cf8, #60a5fa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}

/* Animations */
@keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 20px rgba(147,51,234,0.3); }
    50% { box-shadow: 0 0 40px rgba(147,51,234,0.6); }
}
.upload-zone-active {
    border-color: #9333EA;
    box-shadow: 0 0 30px rgba(147,51,234,0.5);
    transform: scale(1.02);
}
```

---

## 🎨 Color Tokens Reference

```css
/* Backgrounds */
--bg-primary: #0f0f0f;
--bg-secondary: #1a1a1a;
--bg-glass: rgba(15, 15, 15, 0.95);

/* Accents */
--accent-purple: #9333EA;
--accent-purple-light: #A855F7;
--accent-indigo: #6366F1;

/* Gradients */
--gradient-primary: linear-gradient(135deg, #9333EA, #6366F1);
--gradient-backdrop: linear-gradient(135deg, rgba(147,51,234,0.4), rgba(99,102,241,0.5), rgba(59,130,246,0.4));

/* Text */
--text-primary: #FFFFFF;
--text-secondary: #A1A1AA;
--text-muted: #71717A;

/* Borders */
--border-default: rgba(255,255,255,0.1);
--border-hover: rgba(147,51,234,0.5);
--border-focus: #9333EA;

/* Status */
--status-success: #22C55E;
--status-warning: #F59E0B;
--status-error: #EF4444;
--status-info: #3B82F6;
```

---

## ✅ Acceptance Criteria

1. **Media Upload**
   - [ ] Drag & drop works smoothly with visual feedback
   - [ ] Images display at their natural aspect ratios
   - [ ] Thumbnails are square-cropped with consistent sizing
   - [ ] Delete buttons are easily accessible
   - [ ] Upload progress is clearly visible per-file
   - [ ] Videos show play icon overlay

2. **Form Experience**
   - [ ] Sections are collapsible with smooth animations
   - [ ] Tags are easy to add/remove with suggestions visible
   - [ ] Price inputs format as currency automatically
   - [ ] Form validates before submission with helpful messages

3. **Draft System**
   - [ ] Draft saves work automatically (local storage backup)
   - [ ] User can explicitly save to draft
   - [ ] Drafts are accessible from profile

4. **Publishing Flow**
   - [ ] Clear loading state during upload
   - [ ] Success celebration animation
   - [ ] Redirect to new collection after publish

5. **Responsive**
   - [ ] Fully functional on mobile devices
   - [ ] Touch interactions work smoothly
   - [ ] Scrollable thumbnail strip on mobile

6. **Accessibility**
   - [ ] Keyboard navigation for all interactions
   - [ ] Screen reader friendly labels
   - [ ] Sufficient color contrast

---

## 🔗 Reference Links

- Current Market/Designs Feed: `/designs`
- Current Collection Card Style: `DesignCard.tsx`
- Current Cart/Wishlist Drawers: `CartDrawer.tsx`, `WishlistDrawer.tsx`
- Glass Panel Styling: `GlassBackdrop.tsx`

---

*This prompt should guide the creation of a world-class collection creation experience that feels premium, intuitive, and celebrates the creative process of African fashion design.*
