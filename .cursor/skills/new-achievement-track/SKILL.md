---
name: new-achievement-track
description: >
  Industrialize a new GymLogic achievement / badge ladder from a locked
  grill: 3-ticket split, manifest, CLI scaffold, live-RPC copy, flat icon
  upload. Use when splitting an achievement-track epic, adding badge groups,
  seeding achievement_groups / achievement_tiers, extending
  check_and_grant_achievements or get_badge_status, generating badge icons,
  or when the user says "new achievement track", "badge ladder",
  "industrialize achievements", or mentions T220-style seed+RPC work.
  Overrides split-tickets for this epic type.
---

# New achievement track

Skill drives CLI. The CLI does **not** invent metric SQL.

```bash
npx tsx scripts/achievement-track.ts scaffold path/to/track.json
npx tsx scripts/achievement-track.ts prepare-rpc --stem=foo_achievement_tracks
npx tsx scripts/achievement-track.ts icons --from=dir --slugs=a,b [--apply]
```

Do **not** use `split-tickets` here. After two epics (#482, #509) the shape is **3 tickets**, not T209/T210/T211.

Read [reference.md](reference.md) for ticket templates, manifest schema, and the RPC ritual.

---

## When this skill takes over

After `grill-with-docs` / `epic-brief` / `tech-plan` have **locked**:

- families IN/OUT (UUIDs) or the metric class if there is no family
- copy (group names, tier titles, thresholds, i18n hints)
- metric class: cumulative SUM, `LEAST` of tracks, live chain, circuit runs, …

Then this skill writes the tickets **and** runs the CLI. It does not replace grilling.

---

## 3 tickets — not 5

| Ticket | Mode | What |
|---|---|---|
| Seed + both RPCs + i18n + arch | AFK | CLI `scaffold` + `prepare-rpc`; **metric SQL by hand** |
| Playground + closeout `/_unlock-overlay` + `/achievements` | HITL | paste CLI snippet; no second underscore route |
| Icons generate / upload / UPDATE urls | HITL | art human; CLI `icons` |

T221 (retro grant) is **not** a ticket. AC on the seed ticket: append a `#NNN` stanza to `scripts/retroactive-badge-grant.sql`. Same script, never a second file.

Accordion `/achievements` is data-driven from `get_badge_status`. No React insert if RPC + i18n land.

---

## Pipeline

1. Write the manifest (product lock). Schema: [reference.md](reference.md). Golden replay: `scripts/fixtures/bodyweight-trinity-509.manifest.json` — `renderSeedSql` must match T220 INSERTs.
2. `scaffold` → seed migration (groups/tiers only), i18n merge, arch stub, prompt doc, playground snippet, prints retro stanza.
3. `prepare-rpc` → copies **latest** `CREATE OR REPLACE` of both functions into that seed file, injects `-- APPEND CTEs` / `-- APPEND UNION ALL`, re-GRANTs EXECUTE. Excludes the dest file so it does not copy from itself.
4. **You** write the metric branches at those markers. Identical in grant and status. No `DROP FUNCTION`. `now()` not `clock_timestamp()`.
5. Arch test stub pins IN/OUT UUIDs, last-wins slugs, i18n keys. Add metric-class asserts by hand (live chain, min-of-families, …).
6. Paste playground snippet into `UnlockOverlayPlaygroundPage.tsx`. Keep the ceremony row. Do not add `/_achievements`.
7. Generate icons with GenerateImage (HITL regen until they sit in the CSS frame). Naming **FLAT**: `{slug}_{rank}.png`.
8. `icons --from=<dir> --slugs=…` writes the UPDATE migration. `--apply` uploads PNG+WebP to `badge-icons`. Do **not** UPDATE live `achievement_tiers` from the script. Do **not** use `optimize-badge-icons.ts` (root-only, PNG-URL-only). Nested `badge-icons/{slug}/{rank}` is wrong — prod is flat.

Seed migration before URL migration, always. Applying URL UPDATE first does nothing useful; applying seed after a live URL patch can re-insert NULL icons if you ever re-seed.

---

## Hard no

- YAML / manifest → `UNION ALL` metric SQL
- `movement_family` column
- GenerateImage inside the CLI
- Second retro script, prod run auto, new HITL route
- Rewriting the 16+ existing metric branches
- `DROP FUNCTION check_and_grant_achievements` (42P13)
- Nested storage paths

---

## Verify

```bash
VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npx vitest run scripts/achievement-track.test.ts src/test/<arch>.ts
npx tsc -p tsconfig.app.json --noEmit
```

Never `npx tsc --noEmit` at repo root (vacuous). Scripts: standalone `tsc --ignoreConfig` flags in `build-sandbox-caveat.mdc`.
