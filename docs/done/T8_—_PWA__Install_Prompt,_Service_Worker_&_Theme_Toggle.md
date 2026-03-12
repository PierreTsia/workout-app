# T8 — PWA: Install Prompt, Service Worker & Theme Toggle

## Goal
Make the app installable to the home screen via `vite-plugin-pwa`, implement the one-time install banner, and complete the dark/light theme toggle wiring.

## Scope

### vite-plugin-pwa Setup
- Install and configure `vite-plugin-pwa` in `vite.config.ts`
- Generate `manifest.json`: app name ("Workout"), short name, theme color (`#0f0f13`), background color, display mode `standalone`, icons (192×192, 512×512)
- Configure Workbox for app shell caching (cache HTML, JS, CSS, fonts; network-first for Supabase API calls)
- Register service worker via `vite-plugin-pwa` auto-registration

### Install Banner (Flow 2)
- On first browser open (not installed PWA), show a dismissible banner below the top bar:
  - *"📲 Add to home screen for the best experience"* + **Install** button + **✕** dismiss
- Tapping **Install**: trigger the deferred `beforeinstallprompt` event → native browser install dialog
- Tapping **✕**: dismiss permanently (persisted via `installPromptStateAtom`)
- Banner never shown if app is already running as installed PWA (`window.matchMedia('(display-mode: standalone)')`)
- **"Install app"** option also available in Settings section of `SideDrawer` as a fallback

### Theme Toggle (Flow 7)
- `SideDrawer` Settings section: shadcn `Switch` labeled "🌙 Dark mode"
- Toggle calls `next-themes` `setTheme()` — switches class on `<html>` between `dark` and `light`
- `themeAtom` mirrors the active theme for any component that needs to read it
- Preference persisted via `next-themes` (localStorage) and `themeAtom` (atomWithStorage)
- Light theme: define a `[data-theme="light"]` / `.light` CSS variable override set in `globals.css` mapping to appropriate light palette values

## Out of Scope
- Background sync via Service Worker (offline queue is handled by `SyncService` in T4, not the SW)
- Push notifications (local notifications only, handled in T3 via Web Notifications API)

## Acceptance Criteria
- App passes Lighthouse PWA audit (installable, has manifest, service worker registered)
- Install banner appears on first browser open; dismissed state persists across reloads
- Banner does not appear when running as installed PWA
- "Install app" in Settings triggers the install prompt
- Theme toggle switches between dark and light instantly; preference survives app restart
- Light theme renders legibly with appropriate contrast (no dark-on-dark or light-on-light issues)

## References
- `spec:09100d04-cac9-490e-9368-d90a5492e210/ad32c727-9c73-4e3e-b56c-fa6bd3a02392` — Core Flows: Flow 2 (PWA Install), Flow 7 (Theme Toggle)
- `spec:09100d04-cac9-490e-9368-d90a5492e210/d02152ce-9bf5-42f9-b739-4d073216262f` — Tech Plan: `vite-plugin-pwa`, `next-themes`, `installPromptStateAtom`, `themeAtom`