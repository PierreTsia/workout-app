---
name: Kinetic Logic
colors:
  surface: '#121212'
  surface-dim: '#131317'
  surface-bright: '#39393d'
  surface-container-lowest: '#0e0e12'
  surface-container-low: '#1b1b1f'
  surface-container: '#1f1f23'
  surface-container-high: '#2a292e'
  surface-container-highest: '#353439'
  on-surface: '#e4e1e7'
  on-surface-variant: '#bacac3'
  inverse-surface: '#e4e1e7'
  inverse-on-surface: '#303034'
  outline: '#85948e'
  outline-variant: '#3c4a45'
  surface-tint: '#38debb'
  primary: '#44e5c2'
  on-primary: '#00382d'
  primary-container: '#00c9a7'
  on-primary-container: '#004e40'
  inverse-primary: '#006b58'
  secondary: '#c6c6c7'
  on-secondary: '#2f3131'
  secondary-container: '#454747'
  on-secondary-container: '#b4b5b5'
  tertiary: '#ffc0a1'
  on-tertiary: '#552000'
  tertiary-container: '#ff9862'
  on-tertiary-container: '#762f00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#5ffbd6'
  primary-fixed-dim: '#38debb'
  on-primary-fixed: '#002019'
  on-primary-fixed-variant: '#005142'
  secondary-fixed: '#e2e2e2'
  secondary-fixed-dim: '#c6c6c7'
  on-secondary-fixed: '#1a1c1c'
  on-secondary-fixed-variant: '#454747'
  tertiary-fixed: '#ffdbcb'
  tertiary-fixed-dim: '#ffb692'
  on-tertiary-fixed: '#341100'
  on-tertiary-fixed-variant: '#793100'
  background: '#131317'
  on-background: '#e4e1e7'
  surface-variant: '#353439'
  muted: '#999999'
  border: '#27272a'
typography:
  headline-h1:
    fontFamily: Geist
    fontSize: 3rem
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.05em
  headline-h1-mobile:
    fontFamily: Geist
    fontSize: 2.25rem
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  headline-h2:
    fontFamily: Geist
    fontSize: 1.875rem
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  body-main:
    fontFamily: Geist
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: '1.65'
    letterSpacing: 0em
  label-caps:
    fontFamily: Geist
    fontSize: 0.75rem
    fontWeight: '600'
    lineHeight: 1rem
    letterSpacing: 0.1em
  code-snippet:
    fontFamily: Geist
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: 0em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  container-max-prose: 48rem
  gutter-base: 1rem
  section-gap-lg: 8rem
  section-gap-sm: 4rem
  content-stack: 1.5rem
---

## Brand & Style
This design system establishes a high-performance editorial aesthetic for a fitness technology platform. The personality is disciplined, technical, and stoic, avoiding the frantic energy typical of the fitness industry in favor of "serious craft."

The visual style is **Minimalist-Technical**. It relies on flat planes, precise geometry, and generous whitespace to create a sense of focus. There are no shadows, gradients, or decorative flourishes. The interface communicates through "blunt product facts" and high-contrast typography, evoking the feeling of a premium printed technical manual or a high-end developer tool.

## Colors
The palette is rooted in a deep, near-black environment to reduce eye strain and emphasize the "dark editorial" feel. 

- **Primary Accent (#00c9a7):** A surgical mint-teal used exclusively for calls to action, brand signals, and data-heavy indicators. 
- **Foreground (#f2f2f2):** A soft white used for primary text to maintain high legibility without the harshness of pure #FFFFFF.
- **Muted (#999999):** Reserved for secondary information, meta-data, and placeholder states.
- **Background (#0f0f13):** The base canvas for all marketing surfaces.

## Typography
The system uses **Geist** exclusively, leveraging its technical, monolinear construction to reinforce the brand's precision. 

Headlines are set with tight tracking (letter-spacing) to create a dense, authoritative visual block. Body copy is prioritized for readability with a generous 1.65 line-height, ensuring prose remains approachable despite the dry tone. Use the `label-caps` style for small headers or category tags to create a rhythmic hierarchy.

## Layout & Spacing
The layout follows a "prose-first" philosophy. Content is centered in narrow columns (max-width: 3xl or 768px) to prevent long line lengths and maintain an editorial feel.

- **Mobile:** 16px horizontal padding is mandatory. Sections are stacked vertically with a 4rem gap.
- **Desktop:** The layout remains centered. Vertical spacing between major sections increases to 8rem to emphasize the "generous whitespace" requirement.
- **Grids:** Use a simple 12-column grid for dashboard views, but for marketing surfaces, lean on a single-column stack with flexbox for modular components.

## Elevation & Depth
This design system explicitly rejects shadows and blurs. Depth is achieved through **Flat Tonal Layering**.

- **Level 0 (Base):** Background (#0f0f13).
- **Level 1 (Cards/Surfaces):** Surface (#121212). Elements on this level are distinguished by a subtle 1px border (#27272a).
- **Level 2 (Overlays):** For modals or dropdowns, use the Surface color with a slightly brighter border (#3f3f46) to indicate the topmost layer.
- **Visual Hierarchy:** Hierarchy is established through size and color contrast (Primary Accent vs. Muted) rather than physical z-index metaphors.

## Shapes
Geometry is strictly rectangular with soft-but-precise corners. 

- **Corner Radius:** A universal 8px (0.5rem) radius is applied to buttons, input fields, and cards.
- **No Pill Shapes:** Under no circumstances should buttons or chips be fully rounded. The 8px radius provides enough "humanity" while maintaining the technical structure.
- **Brand Signal:** Use a square or stroke-based icon accompanied by the Geist wordmark.

## Components
- **Primary Button:** Filled with Primary Accent (#00c9a7). Text is #000000, 14px, Semibold. 8px radius. 
- **Secondary Button:** No fill. 1px border (#27272a). Text is Foreground (#f2f2f2). On hover, the border brightens to #999999.
- **Input Fields:** Flat background (#121212) with a 1px border. Focus state is a 1px Primary Accent border. No shadows.
- **Cards:** Used for grouping "blunt facts." Use the Surface color (#121212) with no shadow. 1px border (#27272a).
- **Chips/Tags:** Small rectangular blocks with #121212 background and #999999 text. No icons inside chips.
- **Lists:** Unstyled or simple bulleted lists with high vertical padding (12px) between items to maintain the editorial rhythm.
- **Data Visuals:** Use the Primary Accent for all active data lines. Muted (#999999) for grid lines and axes.