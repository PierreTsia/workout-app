# ADR 0035 — A `locale` argument on every name-emitting MCP tool, resolved at display

- **Status:** Accepted
- **Date:** 2026-11-02
- **Decided in:** Epic Brief / Tech Plan / ticket split for issue [#729](https://github.com/PierreTsia/workout-app/issues/729)
- **Amends:** ADR [0010](0010-localize-catalog-at-display-time.md) · **Supersedes:** ADR 0010 §37 (ranking deferral) and ADR [0031](0031-decision-card-structured-program.md) §Amendment (French `warnings[]` stay for non-UI clients)

## Context

ADR 0010 settled that catalog labels resolve **at display time** from the joined `exercises`
row (`name_en` then `name`), never written into a **Catalog Snapshot**. That rule reached the
React app (`file:src/lib/catalogLabels.ts`) and one MCP surface (`render_session_card`,
`file:supabase/functions/mcp/lib/sessionCard.ts`) — and stopped there.

A new English-speaking athlete, creating a program through the agent, got French exercise
names on every surface — the dry-run preview, the Decision Card, `/programs/:id`, history,
stats — and churned (#729). Four gaps, one class:

1. The MCP catalog fetch omits `name_en` (`file:supabase/functions/mcp/lib/catalogLookup.ts`),
   so every MCP formatter and the Decision Card can only emit French.
2. The MCP read/format tools carry **no `locale` argument**; a third-party agent cannot ask
   for a language. The Decision Card's chain (#677) stops at `en` and left exercise names
   "suivi séparé".
3. The `update_program` markdown `warnings[]` are hardcoded French (`format.ts:645,657`) —
   ADR 0031 §Amendment kept them "for non-UI clients", which is exactly the churn class.
4. `search_exercises` / `resolve_exercises_batch` rank FR-first; ADR 0010 §37 deferred the fix
   behind an audit script and its own ADR.

The write side still cannot know the reader's locale (ADR 0010: `localStorage`, no reliable
server signal), which is why resolution stays at display and the locale travels as an
**argument**, not a stored property.

## Decision

Every MCP tool that emits a user-visible name, muscle label, warning or chrome string accepts
an **optional** `locale` argument (`en` | `fr`). Precedence is **explicit argument →
`user_profiles.locale` (the seed) → `en`**. The MCP **host** locale stays a client-only
fallback, as in ADR 0031 — the server cannot read it.

- **Reads** (`get_upcoming_workouts`, `get_workout_history`, `get_training_stats`,
  `get_program_details`, `search_exercises`, `resolve_exercises`) and **writes**
  (`create_program`, `create_workout_day`) gain the argument. On a write tool it drives only
  the `dry-run`/`rendered` echo and is **stripped before persistence** (the `patchOnly()`
  discipline) — it never localizes a **Catalog Snapshot**.
- Resolution uses one shared server helper mirroring the client rule
  (`name_en` for EN → `name` → snapshot). `muscle_group` and the two warnings are localized
  the same way from a small server table (`src/locales` is unreachable from Deno).
- `search_exercises` / `resolve_exercises_batch` gain a **defaulted** `locale text` parameter
  and rank the caller's locale first in the exact-substring boost.
- The client `/programs/:id` path keeps the catalog embed it already fetches and resolves it
  in `DayCard`.

## Consequences

- **Positive:** an English agent gets English everywhere with one new argument; a French
  athlete is unchanged; the existing programs and history are corrected retroactively (ADR
  0010's benefit, now extended to MCP output). Backward compatible: the argument is optional
  and the RPC param is defaulted.
- **Negative:** the tool contract grows a parameter on eight tools; the server now needs its
  own label table (muscles, two warnings, the AMRAP gloss) that must stay in step with
  `en/catalog.json` (guarded by a parity test). One extra `user_profiles` read per tool call
  (accepted, uncached in v1).
- **Reversals recorded:** the issue first proposed migrating `muscle_group` to English slugs;
  the app already localizes those labels (`catalog.muscles.*`), so the scope narrowed to MCP
  output. It also proposed a code change to align `localeAtom` with `fallbackLng`;
  `file:src/store/atoms.ts` already defaults to `detectLocale(navigator.language) ?? "en"`,
  so only `CONTEXT.md` prose needed fixing.
- **Accepted limitation:** `file:supabase/functions/_shared/programDraft.ts` injects a French
  `exercise_name_snapshot` into the English LLM prompt as context only; output is validated
  against the catalog, so no French reaches the user.

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| Localize at write time (persist `name_en`) | ADR 0010's rejected option — the write side cannot know the reader's locale; it would flip every French user and freeze a preference in history. |
| Client-only fix (React resolves everything; leave MCP French) | Leaves third-party MCP clients (Claude Desktop, Cursor) reading French — the churn class. |
| Migrate `muscle_group` values to English slugs | The app already localizes muscle labels; the only leak is MCP output. The rename touches 11 migrations (~22 `IN (...)` sites), three parallel taxonomy lists, both snapshot columns and `catalogParity` — a large risk for no extra coverage. |
| Backfill French snapshots to English | Destroys the French reading and freezes a display preference, as ADR 0010 already ruled out. |
| Locale from the MCP auth path (a "context" on every request) | The profile read is already a one-row handler call (`render_session_card`); no auth refactor earns its keep. |
| Keep ranking symmetric and ship no `locale` param | ADR 0010 §37's audit gate is replaced by a cheaper, deterministic golden fixture; an EN query should not silently rank a FR row first. |
