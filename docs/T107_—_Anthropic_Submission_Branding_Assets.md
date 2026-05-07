# T107 — Anthropic Submission Branding Assets

## Goal

Curate the visual assets the Anthropic Connectors Directory submission form will request — logo, favicon, 1-3 screenshots of GymLogic running in Claude Desktop with realistic data. Reuse #302's existing branding work where possible (logo SVG, favicon URL); the new work here is the screenshots tailored to the directory listing context.

Addresses Epic Brief Track **A7**: branding assets for submission.

## Mode

**HITL** — visual judgment on screenshot composition (which prompt to capture, what frame, what data shown). Editorial judgment on what the directory listing should communicate at a glance.

## Slice

`logo URL (reuse from #302)` → `favicon URL (already on www.gymlogic.me)` → `2-3 fresh screenshots of GymLogic in Claude Desktop` → `WebP conversion + private hosting URL`

## Dependencies

- **T106** (test account seeded) — screenshots must show realistic data, NOT empty states or test fixtures.
- T105 (Worker deployed) helpful but not strictly required if you capture against the Supabase URL with a documented note.
- **#302's branding work** (T87 — `file:docs/T87_—_Port_shadcn_Primitives_+_Logo.md`) — pull the logo SVG from there.

## Scope

### 1. Logo


| Field      | Value                                                                                                           |
| ---------- | --------------------------------------------------------------------------------------------------------------- |
| Source     | `web/src/components/branding/Logo.tsx` (or wherever #302 placed the master logo)                                |
| Format     | SVG (preferred) or PNG @ 512×512                                                                                |
| Hosting    | Either inline base64 in the form OR a public URL (e.g. `https://www.gymlogic.me/logo.svg` if served by the SPA) |
| Background | Transparent — Anthropic's directory may render on light or dark themes                                          |


If a hostable URL doesn't exist yet, drop the SVG file in `public/` of the SPA so it serves at `https://www.gymlogic.me/logo.svg`. One-line change; piggyback on this ticket.

### 2. Favicon

Already exists at `https://www.gymlogic.me/favicon.ico` (or `.svg`). Verify by `curl -I https://www.gymlogic.me/favicon.ico` returns 200. No new work.

### 3. Screenshots — 2-3 captures showing GymLogic in Claude Desktop

Capture sources (similar to T95 but tailored for the directory listing, not the docs page):


| #            | File                   | What to capture                                                                                                          | Notes                                                                    |
| ------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| 1            | `directory-hero.webp`  | **HERO** — Claude Desktop showing a `create_program` dry-run preview with a polished multi-day program structure visible | Aim for square-ish or 16:10; this is the thumbnail in the directory grid |
| 2            | `directory-tools.webp` | Hammer icon expanded showing all 10 tools with their `annotations.title` visible                                         | Confirms annotations feature; visually proves the tool surface is rich   |
| 3 (optional) | `directory-stats.webp` | A `get_training_stats` response in chat with rendered numbers                                                            | Shows real-data flow                                                     |


**Capture environment**:

- Use the test account from T106 — show real names, real exercises, real numbers.
- Claude Desktop locale: English (per T95 convention; document if you deviate to FR).
- macOS `Cmd+Shift+4` window capture; trim to chat content (avoid OS chrome).
- Target ~1200-1600px wide for retina rendering.

**Convert to WebP**:

```bash
cwebp -q 85 ~/Desktop/directory-hero.png -o /tmp/directory-hero.webp
cwebp -q 85 ~/Desktop/directory-tools.png -o /tmp/directory-tools.webp
# Optional 3rd:
cwebp -q 85 ~/Desktop/directory-stats.png -o /tmp/directory-stats.webp
```

Aim for < 200KB each; drop to `-q 80` if any exceeds.

### 4. Hosting

Anthropic's submission form may accept direct file uploads OR require URLs. Prepare both:

- Upload to `web/public/og/directory/` in the Astro mini-site (or `public/` in the SPA) and commit. Hosted URLs:
  - `https://docs.gymlogic.me/og/directory/directory-hero.webp` (if Astro)
  - `https://www.gymlogic.me/og/directory/directory-hero.webp` (if SPA)
- Keep originals in the password manager / private cloud as backup.

If neither can host quickly, use Anthropic's form upload directly during T108.

### 5. Final asset bundle

Save in the maintainer's password manager / private notes (alongside T106 credentials):

```
Logo URL: https://www.gymlogic.me/logo.svg
Favicon URL: https://www.gymlogic.me/favicon.ico
Screenshot 1 (hero): <URL or file path>
Screenshot 2 (tools): <URL or file path>
Screenshot 3 (stats, optional): <URL or file path>
Asset capture date: <YYYY-MM-DD>
Test account used: directory-reviewer@gymlogic.me (per T106)
```

This snippet feeds T108's form-fill.

## Out of Scope

- New logo design — reuse #302's existing branding.
- Marketing copy / tagline for the directory listing — that goes in T108's form fill, not in this asset-curation ticket.
- Animated demos / video captures — Anthropic submission is static-image only.
- OG card for the directory page — separate concern (#302's T96).

## Acceptance Criteria

- Logo SVG/PNG accessible at a public URL (or saved as a file ready to upload).
- Favicon URL verified (`curl -I` returns 200).
- At least 2 WebP screenshots captured from the test account (T106), showing real data, < 200KB each.
- Screenshots stored at a public URL OR ready as local files for direct form upload.
- Asset bundle snippet saved in maintainer's password manager.
- Demoable: a colleague reviewing the screenshot bundle can describe what GymLogic does + what tools it offers, without prior context.

## References

- Epic Brief: `file:docs/Epic_Brief_—_Publish_MCP_+_Skill_to_Anthropic_Directory_#296.md` (Track A7)
- Tech Plan: `file:docs/Tech_Plan_—_Publish_MCP_+_Skill_to_Anthropic_Directory_#296.md` (Implementation Notes → Deferred ticket scope: A7)
- #302 branding work: `file:docs/T87_—_Port_shadcn_Primitives_+_Logo.md`
- Capture pattern reference: `file:docs/T95_—_Claude_Content_+_Screenshots.md` (cwebp conversion, dimension targets)

