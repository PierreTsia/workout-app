# Epic Brief — About Page

## Summary

This epic adds a public-facing About page at `/about` that communicates the project's mission, open-source nature, and GitHub presence. It is the app's first unauthenticated route, accessible to anyone without login. The page uses a standalone layout (no AppShell chrome), includes a placeholder donation section for future monetization, and is fully translated in English and French. A MIT LICENSE file is added to the repository, and a small About link is added to the login page for discoverability.

---

## Context & Problem

**Who is affected:** Prospective users discovering the app, existing users curious about the project, and potential contributors or sponsors.

**Current state:**
- Every route in the app sits behind `AuthGuard` (`file:src/router/AuthGuard.tsx`) — there is zero public-facing content
- No information about the project's mission, license, or source code is surfaced in the UI
- No way for users to support the project or learn about its open-source nature
- The `SideDrawer` (`file:src/components/SideDrawer.tsx`) links to `/history` and `/builder` only — no informational pages
- No `LICENSE` file exists in the repository
- The login page (`file:src/pages/LoginPage.tsx`) offers no context about what the app is or why it exists

**Pain points:**

| Pain | Impact |
|---|---|
| No public presence | Users who land on the app see a login wall — no context about what the app does or why it exists |
| No project transparency | Open-source project with no visible license, no contributor info, no GitHub link in the UI |
| No support mechanism | Users who want to support the project have no way to discover how |

---

## Goals

| Goal | Measure |
|---|---|
| Public discoverability | `/about` loads without authentication and renders in < 2s on mobile |
| Project transparency | License, GitHub link, and contributor info visible on the page |
| i18n parity | 100% of About page copy available in both EN and FR |
| Donation readiness | Donation section present with placeholder — ready to activate when a platform is chosen |

---

## Scope

**In scope:**

1. **Public `/about` route** — new route outside `AuthGuard` in `file:src/router/index.tsx`, rendered with a standalone layout (no sidebar, no auth-dependent header)
2. **About page component** (`src/pages/AboutPage.tsx`) with these sections:
   - Header: app name + tagline ("Free, open-source workout tracker")
   - Story: 2-3 paragraphs on the project's origin and mission
   - Features highlight: what makes the app different (PWA, offline, open-source, privacy-first)
   - Open Source: MIT license badge, GitHub repo link
   - Support: "Love the app?" section with placeholder donation link and "coming soon" treatment
   - Credits: Pierre Tsiakkaros (creator) + "AI-assisted development" acknowledgement
3. **Standalone layout** — the About page has its own minimal layout with a "back to app" / "login" link, independent of `AppShell`
4. **i18n** — all copy in `src/locales/en/about.json` and `src/locales/fr/about.json` (new `about` namespace)
5. **Navigation integration** — add "About" link in `SideDrawer` for authenticated users
6. **MIT LICENSE file** — add to the repository root
7. **Login page link** — add a small "About" link on `file:src/pages/LoginPage.tsx` for unauthenticated visitors

**Out of scope:**

- Active donation integration (Ko-fi, GitHub Sponsors, etc.) — placeholder only
- Footer component for the main app layout
- SEO meta tags, Open Graph, or structured data
- Analytics or event tracking for the About page
- CMS or dynamic content management

---

## Success Criteria

- **Numeric:** `/about` loads and renders fully in < 2 seconds on a throttled 3G mobile connection
- **Numeric:** 100% of user-visible strings on the About page exist in both EN and FR locale files
- **Qualitative:** An unauthenticated user can navigate to `/about` and understand what the app does, who built it, and where to find the source code
- **Qualitative:** The donation section is visually present but clearly indicates it's "coming soon" — no broken links
- **Qualitative:** An authenticated user can reach the About page from the sidebar menu
- **Qualitative:** The About page is accessible from the login screen via a visible link

---

## Dependencies

- None. This epic has no blockers — it is a standalone static page with no data model or API requirements.

---

## Open Questions

- Exact copy/narrative for the "Story" section — to be written during implementation. The epic defines the structure, not the prose.
- Which donation platform to activate when the placeholder is replaced — deferred to a future decision.
