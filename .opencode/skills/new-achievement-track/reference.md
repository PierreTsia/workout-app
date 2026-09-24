# Achievement-track reference

## Manifest schema

JSON, validated by `parseManifest` in `scripts/achievement-track-lib.ts`.

```json
{
  "issue": 509,
  "stem": "bodyweight_trinity_achievement_tracks",
  "title": "Bodyweight Trinity",
  "playgroundMixedLabel": "BW mixed",
  "groups": [
    {
      "slug": "push_ups",
      "sortOrder": 17,
      "nameFr": "Pompes",
      "nameEn": "Push-ups",
      "descriptionFr": "…",
      "descriptionEn": "…",
      "metricType": "push_ups",
      "thresholdHintFr": "Cumuler {{target}} pompes",
      "thresholdHintEn": "Accumulate {{target}} push-ups",
      "playgroundLabel": "Pompes",
      "family": {
        "cteName": "push_up_ids",
        "inUuids": ["…"],
        "outUuids": ["…"]
      },
      "iconSubjects": {
        "bronze": "a nose almost touching a dark gym floor…",
        "silver": "…",
        "gold": "…",
        "platinum": "…",
        "diamond": "…"
      },
      "tiers": [
        { "rank": "bronze", "titleFr": "Nez au sol", "titleEn": "Nose to Floor", "threshold": 100 },
        { "rank": "silver", "titleFr": "Piston", "titleEn": "Piston", "threshold": 500 },
        { "rank": "gold", "titleFr": "Mur de pompes", "titleEn": "Push-up Wall", "threshold": 2500 },
        { "rank": "platinum", "titleFr": "Le Vérin", "titleEn": "The Jack", "threshold": 10000 },
        { "rank": "diamond", "titleFr": "La Pompe éternelle", "titleEn": "The Eternal Pump", "threshold": 25000 }
      ]
    }
  ]
}
```

Rules:

- `stem` must match `^[a-z0-9_]+_achievement_tracks$` — arch tests glob on that substring.
- Each group has **exactly** the five ranks bronze → diamond.
- `family` is optional (master tracks like `bw_expert` have none). UUIDs feed the arch stub only; they are **not** turned into SQL by the CLI.
- `iconSubjects` optional; prompt doc writes `TODO` rows when missing.
- `nameFr` / `nameEn` must equal i18n `groups.*` (overlay chips vs accordion headers).

Golden file: `scripts/fixtures/bodyweight-trinity-509.manifest.json`. First CLI test: replay scaffold seed against `20260820220000_bodyweight_trinity_achievement_tracks.sql`. Do not re-scaffold #509 into this repo.

---

## Ticket templates

Follow `.cursor/rules/docs-format.mdc`. Number from the highest existing `T{n}`.

### Seed + RPCs + i18n + arch (AFK)

- Slice: `migration (seed + both RPCs) → achievements.json → accordion (data-driven) → arch test`
- Scope: CLI scaffold + prepare-rpc; **hand-written** metric SQL at the APPEND markers; i18n three bags × FR/EN; arch last-wins; retro stanza AC
- Out of scope: playground, icons, `syncService.ts`, new route, `movement_family`
- AC must include: groups seeded `icon_asset_url` NULL; both RPCs expose the new slugs with identical family CTEs; `/achievements` shows locked rows; arch green with `VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npx vitest run`

### Playground + closeout (HITL)

- Slice: `UnlockOverlayPlaygroundPage` fixtures + tests → local migrate + retro SQL → `/_unlock-overlay` + `/achievements`
- Paste `docs/playground-snippet-<stem>.tsx`. Keep the original 9 ceremony buttons on row 1.
- **Do not** add `/_achievements` or a second underscore route.
- Checklist: overlay chips use `groups.*` (no raw keys); sort after the previous last group; empty history = locked bronze / 0 progress; family IN counts / OUT does not; metric-class eyeball (Cindy, timezone, live chain, …)

### Icons (HITL)

- Slice: prompts → 25 PNG → CLI `icons --apply` → UPDATE migration → eyeball
- Naming: `{slug}_{rank}.png` → Storage `badge-icons/{slug}_{rank}.webp` (**flat**)
- UPDATE keyed on `group_id` + `rank` for **these slugs only**. Do not replace RPC bodies in that file.
- Visual QA: CSS rank frames sm/md/lg; no text / extra circle baked in; locked grayscale readable

---

## RPC ritual (fragile — do this by hand)

1. `prepare-rpc` copies live bodies. Confirm the source filenames it prints (latest `CREATE OR REPLACE` **excluding** the dest seed file).
2. Insert family UUID CTEs at `-- APPEND CTEs` (immediately before `metrics AS (`).
3. Insert `UNION ALL` branches at `-- APPEND UNION ALL` (end of `metrics`).
4. Copy the **same** CTE + branch SQL into **both** functions. Arch last-wins is the net if a later patch drops them; CTE parity is the net for grant/status drift.
5. Never `DROP FUNCTION check_and_grant_achievements` — 42P13 vs `syncService` (RETURNS TABLE including `threshold_value`).
6. `now()` not `clock_timestamp()`. Day buckets: `(logged_at AT TIME ZONE tz)::date` with `user_profiles.timezone` COALESCE `'UTC'`.
7. Re-GRANT is already appended by the CLI. Leave it.
8. Metric classes seen so far — pick one, don't invent a DSL:
   - lifetime SUM of numeric `reps_logged` (`~ '^\d+$'`), no block filter (circuit stations count 1:1)
   - `LEAST` of several COALESCE'd sums (master track)
   - live chain with today/yesterday grace — **not** `MAX(streak_len)`
   - circuit `qualifying_runs` / slug lists

---

## Icon recipe suffix (verbatim on every prompt)

`, centered composition, game UI icon asset, circular vignette, no border, no frame, no text, high detail, 512×512 PNG`

Rank backgrounds: copper / steel / amber / blue-slate / purple-indigo radial, near-black edges. See `docs/done/badge-icon-prompts.md`.

Optimize: 256×256 WebP q80. The CLI does this. `scripts/optimize-badge-icons.ts` does **not**.

Public URLs always point at **prod** Storage (`favusepjqwpcroiolvaz`), even when the app `.env.local` is local Supabase. That is the #482 / #509 lock.

---

## CLI notes

- `scaffold --force` required to overwrite existing outputs.
- `prepare-rpc --stem=` must match the seed filename `*_<stem>.sql`. Refuses if that file already has RPC bodies; `--force` recopies and drops metric SQL.
- `icons --apply` uploads; it does **not** `UPDATE achievement_tiers` via the JS client. The SQL file is the backfill.
- `--no-env-local` (via `load-env.ts`) when uploading to prod while `.env.local` points at 127.0.0.1.
