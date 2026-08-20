# T223 — Badge icons generate / upload / backfill

## Goal

Produce the 25 Bodyweight Trinity badge icons, upload them to Storage, and backfill `achievement_tiers.icon_asset_url` so `/achievements` and `/_unlock-overlay` show art instead of empty frames. Addresses Epic story 21 (nullable at seed → URLs after) and story 22 (icons on HITL).

## Mode

HITL — generation and visual QA need a human to pick among model outputs; upload/SQL is mechanical once files exist.

## Slice

prompts → 25 PNG → `npx tsx scripts/achievement-track.ts icons --from=dir --slugs=…` → follow-up `UPDATE` migration → `/_unlock-overlay` + `/achievements` eyeball

## Dependencies

T220 (tiers must exist to UPDATE). T222 can ship with `icon_asset_url` NULL; this ticket can land after closeout.

## Scope

### Generate

25 icons, recipe identical to `file:docs/done/badge-icon-prompts.md`. **Copy-paste prompts:** `file:docs/badge-icon-prompts-bodyweight-tracks-509.md`.

Naming: `{group_slug}_{rank}.png` then Storage **FLAT** `badge-icons/{group_slug}_{rank}.webp` — same as #482 circuit icons. Not nested `{slug}/{rank}` folders.

| Slug | Ranks |
|---|---|
| `push_ups` | bronze → diamond |
| `pull_ups` | bronze → diamond |
| `bw_squats` | bronze → diamond |
| `bw_expert` | bronze → diamond |
| `hundred_a_day` | bronze → diamond |

### Optimize + upload

- `npx tsx scripts/achievement-track.ts icons --from=<png-dir> --slugs=push_ups,pull_ups,bw_squats,bw_expert,hundred_a_day --apply`
- Public bucket `badge-icons` (already exists from #129 / #482), **flat** `{slug}_{rank}.webp`
- Do not recreate the bucket
- Do **not** use `scripts/optimize-badge-icons.ts` (root-only listing, PNG-URL-only UPDATE)

### Backfill

Follow-up migration `UPDATE achievement_tiers SET icon_asset_url = '…'` keyed on `group_id` + `rank` for the five slugs only. Do **not** rewrite the RPC bodies in that migration.

### Visual QA (HITL)

| Check | Pass |
|---|---|
| All 25 render in CSS rank frames (sm / md / lg) | |
| Locked grayscale + opacity readable with real art | |
| `/_unlock-overlay` Pompes ladder + Hard Time diamond show icons | |
| `/achievements` accordion + drawer show icons | |
| Dark/light rank frames still work | |
| No text / no extra circular frame baked into the PNG (recipe suffix) | |

## Out of Scope

- Changing CSS frames, overlay layout, or copy
- Regenerating circuit / #218 icons
- New playground route
- RPC metric changes

## Acceptance Criteria

- [ ] 25 optimized assets in `badge-icons/{slug}_{rank}.webp`
- [ ] `icon_asset_url` non-null for all 25 new tiers
- [ ] Existing groups’ URLs untouched
- [ ] HITL QA table completed on `/_unlock-overlay` + `/achievements`
- [ ] Arch test still green (RPC bodies unchanged by the UPDATE migration)

## References

- Prompts: `file:docs/badge-icon-prompts-bodyweight-tracks-509.md`
- Recipe: `file:docs/done/badge-icon-prompts.md`
- Circuit precedent: `file:docs/done/badge-icon-prompts-circuit-tracks-482.md`
- Upload: `file:scripts/achievement-track.ts` (`icons`)
- Epic story 21, 22
- Tech Plan: icons NULL at seed, art later
