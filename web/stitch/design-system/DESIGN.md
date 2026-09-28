---
name: GymLogic Precision
colors:
  surface: '#15151c'
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
  on-primary: '#000000'
  primary-container: '#00c9a7'
  on-primary-container: '#004e40'
  inverse-primary: '#006b58'
  secondary: '#c7c5d0'
  on-secondary: '#303038'
  secondary-container: '#494851'
  on-secondary-container: '#b9b7c2'
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
  secondary-fixed: '#e4e1ec'
  secondary-fixed-dim: '#c7c5d0'
  on-secondary-fixed: '#1b1b23'
  on-secondary-fixed-variant: '#46464f'
  tertiary-fixed: '#ffdbcb'
  tertiary-fixed-dim: '#ffb692'
  on-tertiary-fixed: '#341100'
  on-tertiary-fixed-variant: '#793100'
  background: '#131317'
  on-background: '#e4e1e7'
  surface-variant: '#353439'
  foreground: '#f2f2f2'
  muted: '#999999'
  border: '#2d2d37'
typography:
  headline-lg:
    fontFamily: Geist
    fontSize: 3rem
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.025em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 2.25rem
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.025em
  headline-md:
    fontFamily: Geist
    fontSize: 1.875rem
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Geist
    fontSize: 1.125rem
    fontWeight: '600'
    lineHeight: '1.35'
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Geist
    fontSize: 1.125rem
    fontWeight: '400'
    lineHeight: '1.65'
  body-md:
    fontFamily: Geist
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: '1.65'
  body-sm:
    fontFamily: Geist
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: '1.55'
  label:
    fontFamily: Geist
    fontSize: 0.875rem
    fontWeight: '500'
    lineHeight: '1.4'
  mono:
    fontFamily: Geist Mono
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: '1.5'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-prose: 48rem
  container-media: 64rem
  gutter: 1rem
  section-gap: 6rem
  section-gap-mobile: 4rem
  unit-xs: 4px
  unit-sm: 8px
  unit-md: 16px
  unit-lg: 24px
  unit-xl: 32px
---

## Brand & Style

The design system is built on an editorial, dark-mode aesthetic that prioritizes craft and product precision over marketing hype. It is designed for a serious fitness audience that values utility and technical excellence. 

The visual style is a blend of **Minimalism** and **High-Contrast Boldness**, characterized by:
- **Blunt Precision:** A "dry wit" tone that presents product facts without unnecessary flourish.
- **Dark Canvas:** A near-black environment that focuses the eye on content and the single mint-teal accent.
- **Spacious Hierarchy:** Reliance on generous whitespace and strict typographic scaling rather than decorative elements like glows, gradients, or glassmorphism.
- **Editorial Layout:** A single-column journey approach (specifically for "Tour" scenes) that avoids the cluttered "card-grid" look common in SaaS.

## Colors

The palette is strictly functional, utilizing a deep, near-black foundation to create a sophisticated, high-end atmosphere.

- **Primary (#00c9a7):** A mint-teal reserved exclusively for interactive signals, active states, and brand iconography. It must always be paired with Black (#000000) for text legibility.
- **Neutral/Background (#0f0f13):** The primary canvas. It is never pure black, ensuring depth and softness.
- **Surfaces (#15151c, #1a1a22):** Used for section banding and interactive containers (cards). These provide subtle elevation without needing shadows.
- **Foreground (#f2f2f2):** A soft white for maximum readability without the harshness of pure white.
- **Muted (#999999):** Reserved for secondary information and de-emphasized navigation elements.

## Typography

Typography is the primary driver of the design system's personality. 
- **Font Selection:** Use **Geist** for all UI elements and marketing prose to maintain a clean, technical appearance. **Geist Mono** is strictly reserved for technical snippets, URLs, or metadata.
- **Hierarchy:** Headlines (H1) should be tight and impactful. Paragraphs (Body) use a relaxed line-height (1.65) to ensure high readability for dense product facts.
- **Alignment:** Prefer left-aligned text for prose columns to maintain the editorial "dry" feel.

## Layout & Spacing

The layout philosophy follows a **fixed-width, centered-column model** that prioritizes focus over density.

- **Prose Column:** Content-heavy sections are restricted to a narrow `48rem` (768px) width to optimize line length for reading.
- **Media Width:** Device galleries and tour screenshots can expand to a wider `64rem` (1024px) to showcase UI details.
- **Vertical Rhythm:** Sections are separated by large gaps (`64px` to `96px`) to allow the editorial content room to breathe. 
- **First Viewport:** Maintain a "single composition" hero. Avoid secondary modules like feature chips or trust bars above the fold.
- **Responsiveness:** On mobile, reduce section gaps to `4rem` and shrink the H1 to `2.25rem`. Use a consistent 16px side margin for all screen sizes.

## Elevation & Depth

This system avoids traditional shadows in favor of **Tonal Layers**. 
- **Flat Planes:** Depth is achieved by placing `surface` (#15151c) or `card` (#1a1a22) elements against the `background` (#0f0f13).
- **Hairline Borders:** Use low-contrast borders (#2d2d37) to define edges. Do not use high-contrast borders or bright grids.
- **Shadows:** Only apply a soft, black-tinted ambient shadow (`black/40`) to device mocks to lift them slightly from the background. 
- **Interactive States:** Buttons may use a subtle 1px inset highlight (white at 15% opacity) to provide a tactile "pressed" feel without looking skeuomorphic.

## Shapes

The shape language is geometric and disciplined.
- **Standard Radius:** 8px (`md`) for all buttons, inputs, and primary controls.
- **Large Radius:** 12px (`lg`) for cards, device frames (phone/desktop mocks), and interactive image tiles.
- **Strictness:** Avoid fully rounded pill shapes or "squircle" extremes. The goal is a professional, slightly industrial feel.

## Components

### Buttons
- **Primary:** Filled with Mint-Teal (#00c9a7), using Black (#000000) text. Sharp 8px corners. Copy should be blunt (e.g., "Open the app →").
- **Secondary:** Transparent background with a #2d2d37 border and soft white text. Used for secondary actions like "Connect your agent."

### Cards & Containers
- **Tour Scenes:** Use a **card-less layout**. Present the title, prose, and device mock directly on the background canvas.
- **Interactive Tiles:** Use the `card` background (#1a1a22) and 12px radius only when the entire block is clickable.
- **Hairlines:** Use 1px rules (#2d2d37) to separate footer sections or navigation headers.

### Device Frames
- **Phone Mocks:** 9:19 aspect ratio, 12px radius, thin border stroke.
- **Desktop Mocks:** 16:10 aspect ratio with minimal window chrome in the `surface` color.

### Navigation
- **Header:** Transparent on idle; becomes `background` with 70% opacity and a backdrop blur on scroll.
- **Links:** Muted text color. Active state is indicated by the primary accent color and a subtle underline offset.