# Stitch — GymLogic design inputs (export)

Exported **2026-09-28** from the Stitch workspace owned by the `mirakl.com` account, to
recreate the GymLogic Stitch project **from scratch** under a personal account. No live
migration exists in the Stitch API (no share/transfer tool), so these are the portable inputs.

## Design systems

| File | System | Use |
|---|---|---|
| `DESIGN.md` | **GymLogic Precision** | Canonical product design system (from Builder #503). |
| `DESIGN-marketing-kinetic-logic.md` | **Kinetic Logic** | Marketing site variant (from the Product Tour project). |
| `DESIGN-friends.md` | **GymLogic Precision** | As used by Friends #526 (kept only if it differs). |
| `design-tokens.json` | — | Named colors, typography, spacing, roundness. |

## Reference screens

`references/` — **40 screens** (HTML + PNG) from 3 original projects:

- `references/friends-526/` — Friends & accountability (#526)
- `references/marketing/` — Product Tour, hero, **Connect your agent**
- `references/builder-503/` — Hevy-class Day Editor (#503)

Full list (titles + original screen ids): `INVENTORY.md`.

## Recreate the project from scratch

1. Stitch → **New project**.
2. Give it the design system: paste `DESIGN.md` (`create_design_system_from_design_md`).
3. Bring back reference screens as needed:
   `stitch-mcp upload -p <projectId> -f references/<...>.html --title "<title>"`
4. Generate new screens from the same design system.

## Provenance

Original (private) Stitch project ids — all under the `mirakl.com` account:

- `8811911488687805115` — GymLogic Friends (#526)
- `1596884641132397118` — Marketing Design System
- `8226627093115563258` — Builder (#503)

> `Agent Logic` (in `marketing/`) is the *marketing* "Connect your agent" scene (MCP/BYOA),
> not the in-app experimental agent mode.
