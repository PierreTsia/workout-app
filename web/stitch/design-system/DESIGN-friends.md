---
name: GymLogic Precision
colors:
  surface: '#121317'
  surface-dim: '#121317'
  surface-bright: '#38393d'
  surface-container-lowest: '#0d0e12'
  surface-container-low: '#1a1b1f'
  surface-container: '#1e1f23'
  surface-container-high: '#292a2e'
  surface-container-highest: '#343539'
  on-surface: '#e3e2e7'
  on-surface-variant: '#c1c6d7'
  inverse-surface: '#e3e2e7'
  inverse-on-surface: '#2f3034'
  outline: '#8b90a0'
  outline-variant: '#414754'
  surface-tint: '#aec6ff'
  primary: '#aec6ff'
  on-primary: '#002e6b'
  primary-container: '#0070f3'
  on-primary-container: '#ffffff'
  inverse-primary: '#0059c5'
  secondary: '#c9c6c5'
  on-secondary: '#313030'
  secondary-container: '#4a4949'
  on-secondary-container: '#bab8b7'
  tertiary: '#c8c6c8'
  on-tertiary: '#303032'
  tertiary-container: '#767578'
  on-tertiary-container: '#fffeff'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#aec6ff'
  on-primary-fixed: '#001a43'
  on-primary-fixed-variant: '#004397'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c9c6c5'
  on-secondary-fixed: '#1c1b1b'
  on-secondary-fixed-variant: '#474646'
  tertiary-fixed: '#e4e2e4'
  tertiary-fixed-dim: '#c8c6c8'
  on-tertiary-fixed: '#1b1b1d'
  on-tertiary-fixed-variant: '#474649'
  background: '#121317'
  on-background: '#e3e2e7'
  surface-variant: '#343539'
typography:
  headline-xl:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: 0em
  body-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: 0em
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  label-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-display:
    fontFamily: Geist
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style
The design system is engineered for elite performance and cognitive focus. It targets professional athletes and data-driven fitness enthusiasts who value precision over decoration. 

The aesthetic is **Technical Minimalism** with a **Dark-Mode-First** philosophy. It utilizes a "Command Center" approach: high-contrast data points against deep, non-distractive backgrounds. The style incorporates subtle **Glassmorphism** to indicate hierarchy and **High-Contrast** accents to drive action. The emotional response is one of serious intent, reliability, and peak efficiency.

## Colors
The palette is rooted in a deep charcoal foundation to reduce eye strain in low-light gym environments. 

- **Primary (#0070F3):** An electric blue used exclusively for interactive elements, progress indicators, and "active state" telemetry.
- **Background (#0A0A0A):** The true-dark base for the entire interface.
- **Surface (#121212):** Used for cards and containers to create subtle separation from the background.
- **Typography:** Headlines must remain crisp white (#FFFFFF) for maximum legibility, while secondary data and labels use slate (#8E8E93) to maintain visual hierarchy.

## Typography
This design system utilizes **Geist** exclusively to leverage its technical, monospaced-inspired terminals and exceptional legibility. 

- **Headlines:** Use tight letter-spacing and bold weights to convey strength.
- **Labels:** Always use medium weight and slight tracking (0.05em) to differentiate from body text. 
- **Data Display:** A specific role for high-impact numbers (reps, weight, heart rate), utilizing the tabular lining figures inherent in Geist for vertical alignment in dashboards.

## Layout & Spacing
The layout follows a **Fluid Grid** model with a strict 4px baseline rhythm to maintain a "scientific" feel. 

- **Grid:** Use a 12-column grid for desktop and a 4-column grid for mobile. 
- **Gutters:** Standardized at 16px to ensure density without clutter.
- **Rhythm:** All vertical spacing between related components should use increments of 8px, while section breaks use 40px (xl) to provide breathing room in complex data views.

## Elevation & Depth
Elevation is communicated through **Tonal Layering** and **Glassmorphism** rather than traditional heavy shadows.

- **Level 0:** Background (#0A0A0A).
- **Level 1 (Cards/Containers):** Surface (#121212) with a 1px thin outline (#1D1D1F).
- **Level 2 (Overlays/Modals):** Semi-transparent surface with a 20px backdrop blur and a vibrant top-edge highlight (0.5px white at 10% opacity) to simulate professional glass hardware.
- **Shadows:** If used, shadows should be highly diffused and near-black, serving only to separate floating elements from the grid.

## Shapes
The shape language is "Soft-Technical." We avoid the clinical feel of sharp corners while steering clear of the playfulness of pill shapes. 

- **Default Radius:** 4px for small components (inputs, tags).
- **Large Radius:** 8px for containers and cards. 
- **Interactive States:** On hover or active state, shapes do not change radius; instead, they receive a 1px Electric Blue border to indicate focus.

## Components
- **Buttons:** Primary buttons use a solid Electric Blue fill with white semi-bold text. Secondary buttons use a transparent fill with a 1px slate outline.
- **Input Fields:** Dark surfaces (#0A0A0A) with a 1px outline (#1D1D1F). Upon focus, the outline transitions to Electric Blue.
- **Chips:** Small, 4px radius containers used for workout tags. Use Slate background with white text for inactive, and Electric Blue background for active.
- **Progress Bars:** Use a thick 8px track. The unfilled track is #1D1D1F, and the filled track is a gradient of Electric Blue.
- **Cards:** Background at #121212, 8px radius, 1px outline. Content should be padded at 16px (md) or 24px (lg).
- **Data Visualizations:** Charts should use Electric Blue for the primary data line, with a subtle glass-blur fill beneath the curve to provide depth.