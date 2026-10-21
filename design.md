---
name: Geometric Minimalist Intelligence
colors:
  surface: '#f5fbf5'
  surface-dim: '#d5dcd6'
  surface-bright: '#f5fbf5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff5ef'
  surface-container: '#e9efe9'
  surface-container-high: '#e4eae4'
  surface-container-highest: '#dee4de'
  on-surface: '#171d19'
  on-surface-variant: '#3d4a42'
  inverse-surface: '#2c322e'
  inverse-on-surface: '#ecf2ec'
  outline: '#6d7a72'
  outline-variant: '#bccac0'
  surface-tint: '#006c4a'
  primary: '#006948'
  on-primary: '#ffffff'
  primary-container: '#00855d'
  on-primary-container: '#f5fff7'
  inverse-primary: '#68dba9'
  secondary: '#1b6b4f'
  on-secondary: '#ffffff'
  secondary-container: '#a6f2cf'
  on-secondary-container: '#247155'
  tertiary: '#9b3e3b'
  on-tertiary: '#ffffff'
  tertiary-container: '#ba5551'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#85f8c4'
  primary-fixed-dim: '#68dba9'
  on-primary-fixed: '#002114'
  on-primary-fixed-variant: '#005137'
  secondary-fixed: '#a6f2cf'
  secondary-fixed-dim: '#8bd6b4'
  on-secondary-fixed: '#002115'
  on-secondary-fixed-variant: '#00513a'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3ae'
  on-tertiary-fixed: '#410004'
  on-tertiary-fixed-variant: '#7f2928'
  background: '#f5fbf5'
  on-background: '#171d19'
  surface-variant: '#dee4de'
  icon-primary: '#059669'
  icon-secondary: '#a7f3d0'
  icon-accent: '#064e3b'
  canvas-base: '#f8fafc'
  surface-card: '#ffffff'
  border-subtle: '#e2e8f0'
  text-primary: '#0f172a'
  text-muted: '#64748b'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  title-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.005em
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: '0'
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: '0'
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: '0'
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.02em
  numeric-metric:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.03em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-sm: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system delivers an architectural, serene financial dashboard experience defined by high-clarity geometry, disciplined spatial order, and an expressive yet minimalist duotone iconography system. The aesthetic balances institutional trust with modern digital agility, targeting data-dense fintech, asset management, and analytics platforms.

### Design Movement: Modern Minimalist & Pure Geometric Abstraction
The visual philosophy pairs Swiss functional clarity with pure modernist geometric abstraction:
- Pure Geometric Archetypes: Visual meaning and navigation signposts are distilled into fundamental primitives (circles, semicircles, quarter-circles, and rounded rectilinear capsules). Metaphors are communicated through compositional balance rather than skeuomorphic detail.
- Harmonious Tonal Rhythm: Cool slate canvases let elevated white card containers breathe, while a chromatic hierarchy of emerald tones guides user attention without visual friction.
- Intentional Contrast: Micro-interactions, structured tabular displays, and layered vector elements interact via subtle overlaps and multiply blend modes to evoke depth without decorative excess.

## Colors

The color palette centers on a disciplined three-tier chromatic emerald hierarchy coupled with a calm, non-glare cool slate structural system.

### Color Roles & Guidelines
- Primary Emerald (#059669): Represents actionable elements, active states, key visual centroids, and foreground shapes in the duotone iconography.
- Secondary Mint Tint (#A7F3D0): Acts as the foundational ambient tone, supporting geometric silhouettes, secondary icon backdrops, pill container backgrounds, and highlight overlays.
- Deep Emerald Accent (#064E3B): Reserved for focal points, high-contrast focal components, micro-intersections, active text on tinted pills, and pressed states.
- Neutral Canvas (#F8FAFC): The default application canvas, reducing optical glare across large displays and creating separation against card elevations.
- Card Surface (#FFFFFF): Strictly allocated for elevated modules, floating panels, modal dialogues, and icon canvas containers.
- Text & Structural Borders: #0F172A delivers uncompromising legibility for quantitative data and titles, while #64748B anchors secondary labels. Structural boundaries utilize #E2E8F0 at 1px for effortless delineation.

## Typography

Plus Jakarta Sans provides typographic coherence, combining modern geometry with open counters and tabular numerals for data visualization.

### Rules of Typesetting
- Metric Figures: Always render monetary metrics and quantitative readouts with font-variant-numeric: tabular-nums to eliminate layout jitter during real-time data streaming.
- Section Headers & Icon Labels: Icon captions and widget headers utilize title-md and label-md with neutral tracking for immediate scanability.
- Micro-labels & Status Badges: Use label-sm with uppercase transformation and 0.02em tracking when enclosed in pill or duotone badge containers.

## Layout & Spacing

Layouts adhere to an 8px modular cadence governed by strict vertical and horizontal alignments.

### Grid Architecture
- Desktop (>= 1280px): 12-column layout with 24px (space-lg) gutters and 32px (space-xl) canvas margins. Side navigation rails maintain fixed widths (72px collapsed, 240px expanded).
- Tablet (768px - 1279px): 8-column adaptive layout, 16px (space-md) gutters, 24px outer margins. Content modules wrap into balanced two-column configurations.
- Mobile (< 768px): 4-column flow with 16px lateral padding. Complex charts and multi-pane widgets collapse into stacked single-column units.
- Component Padding: Standard cards employ 24px padding (space-lg), while compact data rows, badges, and icon buttons utilize 8px to 16px (space-sm to space-md).

## Elevation & Depth

This design system avoids heavy shadows, simulating physical hierarchy through ambient luminescence, tonal surface shifts, and micro-borders.

### Elevation Hierarchy
- Level 0 (Canvas Base): Flat #F8FAFC, non-elevated.
- Level 1 (Card & Module Surfaces): Solid #FFFFFF, bordered by 1px #E2E8F0, accompanied by an ambient shadow:
  box-shadow: 0px 4px 20px -2px rgba(15, 23, 42, 0.03), 0px 2px 6px -1px rgba(15, 23, 42, 0.02);
- Level 2 (Popovers, Tooltips & Floating Nav): Surface #FFFFFF, 1px #E2E8F0 border, elevated dispersion shadow:
  box-shadow: 0px 12px 32px -4px rgba(15, 23, 42, 0.06), 0px 4px 12px -2px rgba(15, 23, 42, 0.03);
- Level 3 (Focused Duotone Highlights & Floating Indicators): Emerald glow applied to hero icon badges or active indicators:
  box-shadow: 0px 8px 20px -4px rgba(5, 150, 105, 0.2);

## Shapes

The shape system leverages geometric clarity. Dashboard cards use soft structural rounding, while interactive elements, pills, and icon primitives adhere to pure circular or capsule parameters.

### Radius Assignments
- Cards & Primary Modules: 16px to 20px (rounded-xl scale) to soften large information-dense surfaces.
- Form Controls & Action Buttons: 8px to 12px (rounded to rounded-md) for ergonomic tap states.
- Pills, Badges, & Geometric Icon Sub-shapes: Fully rounded (rounded-full / 9999px) or exact geometric ratios (50% circle radius, precise semicircles).

## Components

### Geometric Duotone Iconography System

The iconography system is built on pure geometric abstraction, communicating functionality through distilled geometric forms rather than literal line art.

#### 1. Color Roles & Palette Mapping
- Primary Tone (#059669): Applied to the dominant visual subject, dynamic foreground element, or primary silhouette (for example, the right semi-circle in Analytics, the speech bubble circle in Discussion, or the bookmark spine).
- Secondary Tone (#A7F3D0): Applied to secondary backing shapes, auxiliary indicators, or contextual envelopes (for example, the soft rounded card background in User Profile, the secondary overlapping disc in Interactions, or the bottom ribbon in Bookmarks).
- Accent Tone (#064E3B): Reserved for focal junctions, high-priority status micro-dots, deep overlapping intersections, or pie-chart quarter segments (for example, Documents pie slice).
- Subtle Overlaps: When shapes overlap, use subtle transparency (opacity: 0.85 or mix-blend-mode: multiply) or a clean 2px negative clearance space to maintain silhouette legibility.

#### 2. Pure Shape Principles
- Primitives Only: Every icon must be constructed exclusively from circles, semicircles, quarter-circles, equilateral triangles with rounded vertices, and rounded rectangles/capsules.
- No Complex Outlines or Skeuomorphism: Icons are solid-fill geometries. Avoid line strokes, internal engravings, or ornamental bevels.
- Form Interlocking: Icons express narrative through the interplay of two contrasting geometries (such as solid circle overlapping a light semicircle, or a rounded rectangle housing a quarter-circle).

#### 3. Grid & Sizing System
- Master Grid Canvas: 24x24px base unit grid with 2px interior padding (20x20px live area) for standard navigation and inline controls.
- Display / Hero Canvas: 48x48px or 64x64px canvas for feature badges, section dividers, and empty states.
- Proportional Geometry: Stroke corners and rectangle corner radiuses scale proportionally (such as 4px radius on 24px canvas; 8px to 12px radius on 48px+ canvas).

#### 4. Icon Catalog Archetypes
- Analytics: Left secondary circle (#A7F3D0) paired with an adjacent right primary semi-circle (#059669).
- User Profile: Solid primary circular head (#059669) hovering over a secondary rounded-card torso (#A7F3D0) with a primary shoulder silhouette.
- Documents: Primary rounded rectangle (#059669) inset with a secondary circular chart displaying an accent quarter-cut (#064E3B / #FFFFFF).
- Devices: Wide secondary base plate (#A7F3D0), overlaid with a primary laptop display (#059669) and an adjacent mini mobile capsule.
- Discussion: Semicircular secondary cradle (#A7F3D0) supporting a primary circle with a micro-tail pointing downward (#059669).
- Components: Balanced horizontal progression of pure triangle (#059669), rounded square (#A7F3D0), and pure circle (#A7F3D0).
- Interactions: Two intersecting circles (#059669 and #A7F3D0) generating an optical intersection zone.
- Bookmarks: Primary vertical rectangle (#059669) completed by a notched secondary ribbon chevron (#A7F3D0).

---

### Dashboard Components

#### Metric & KPI Cards
- Surface container berbingkai 1px #E2E8F0 dengan sudut konsisten kotak modern (6px `rounded-md`).
- Hirarki konsisten luar dan dalam: jika container luar kotak, elemen dalam (sub-card, badge, button, input) juga kotak (`rounded-md` & `rounded-sm`).
- Nilai angka (rupiah, persentase, statistik) ditampilkan dengan tipografi proporsional alami Plus Jakarta Sans yang bulat dan mengalir mulus (tanpa paksaan monospaced `tabular-nums` atau kotak buatan).

#### Navigation Rail & Items
- Navigasi samping rapi dan kompak dengan sudut 6px (`rounded-md`). Item aktif ditandai garis aksen 3px vertikal #059669 dan latar emerald lembut.

#### Action Buttons & Input
- Primary: Solid #059669 background, #FFFFFF text, sudut kotak modern 6px (`rounded-md`), transisi halus ke #047857 saat hover.
- Badges & Chips: Tag geometris kompak 4px (`rounded-sm`), konsisten dengan bingkai kotak tanpa bentuk kapsul/balon yang kontras.
- Input: Sudut kotak konsisten 6px (`rounded-md`) dengan fokus halo emerald halus.
