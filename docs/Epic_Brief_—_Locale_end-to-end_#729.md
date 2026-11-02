# Epic Brief — Locale end-to-end (#729)

## Summary

An English-speaking athlete creating a program through the agent saw French exercise names
on every screen, asked four times for English, and churned. The cause is structural: the
catalog is bilingual (`exercises.name` French, `name_en` English) and ADR 0010 already
decided labels resolve at **display time** from the joined row — but most surfaces read the
frozen French `name_snapshot` instead, several MCP tools emit French by construction, and
none of the read tools accept a `locale`. This epic closes the whole class: every
workout/program surface resolves exercise names, muscle groups, warnings and labels against
the caller's **Display Locale**, the MCP read/write contracts gain a documented `locale`
argument, and MCP muscle labels are localized at display time. Nothing changes for French users.

---

## Context & Problem

**Who is affected:** every English-speaking athlete — arriving mostly through an **External
MCP Client** or the **Embedded Agent** — plus any agent resolving in English.

**Current state:**
- `exercises.name` is French (`NOT NULL UNIQUE`), `name_en` is the English source data (ADR 0010).
- Display is supposed to resolve from the joined `exercises` row (`name_en` then `name`, by
  **Display Locale**), falling back to the **Catalog Snapshot** only when the row is unavailable.
- In practice the MCP catalog fetch omits `name_en` (`file:supabase/functions/mcp/lib/catalogLookup.ts`),
  six write paths freeze the French `name` into `name_snapshot`, the Decision Card and every
  MCP formatter read `name`/`name_snapshot`, and `/programs/:id` fetches `name_en` then
  discards it.
- Only `render_session_card` is locale-aware (`file:supabase/functions/mcp/lib/sessionCard.ts`).
- MCP read/format tools carry **no `locale` argument**; the Decision Card locale chain
  (ADR 0031) stops at `en`, and the #677 plan explicitly deferred exercise names to
  "suivi séparé" — this epic.
- `localeAtom` **already** defaults to `detectLocale(navigator.language) ?? "en"`
  (`file:src/store/atoms.ts`) — the old `"fr"` mismatch is fixed in code; only `CONTEXT.md`'s
  **Display Locale** prose is stale.

**Pain points:**
| Pain | Impact |
|---|---|
| FR names for EN users across program, history, stats, cards | Churn (observed) |
| `get_workout_history` filters by FR snapshot | EN queries silently miss sets |
| MCP tools emit FR by construction, no `locale` arg | Third-party agents can't ask for a language |
| `muscle_group` FR canonical emitted raw by **MCP output** | Agent answers mixed-language (the app already localizes) |
| `search_exercises` / `resolve_exercises` FR-first | EN queries mis-resolve |
| Silent failure on a forgotten surface | Invisible to a FR reviewer (ADR 0010 §Negative) |

---

## User Stories

1. As an **EN athlete** using an **External MCP Client**, I want the program preview to show
   English exercise names and English chrome, so that I can read and approve it.
2. As an **EN athlete** with **existing** programs and history, I want them corrected
   retroactively with no re-save, so that old data is readable too.
3. As an **EN athlete** on `/programs/:id`, I want the day cards to show English names, so
   that browsing the week is consistent.
4. As an **EN athlete**, I want `get_workout_history` to return English names **and** to
   filter on English names, so that searching a movement works.
5. As an **EN athlete**, I want `get_upcoming_workouts`, `get_training_stats` and
   `get_program_details` in English, so that the agent's answers read naturally.
6. As an **EN athlete** accepting a **Decision Card**, I want English exercise names,
   warnings and labels, so that the card is coherent.
7. As a **FR athlete**, I want everything to keep rendering in French, so that nothing regresses.
8. As a **third-party agent**, I want to pass `locale` explicitly on any read/write tool and
   get that language back.
9. As a **third-party agent** that omits `locale`, I want the tool to fall back predictably
   (profile seed → host locale → `en`), never silently French.
10. As an **EN or FR athlete**, I want a catalog rename to correct past programs and history,
    so that history stays truthful (ADR 0010 benefit).
11. As any athlete, I want `muscle_group` localized on every surface (stats, BodyMap, balance),
    so that muscle labels match the UI language.
12. As an **EN athlete**, I want `search_exercises` / `resolve_exercises` to match and rank in
    my locale, so that "bench press" finds the right row before "Développé couché".
13. As any athlete with a **mixed program** (agent-created + hand-added), I want one consistent
    language, so that no line contradicts its neighbour.
14. As an **offline athlete**, I want no extra network on the session path and the snapshot
    fallback intact, so that offline behavior is unchanged.
15. As a **new athlete**, I want the app's default language to match my device, with no flash,
    so that first paint is already correct.
16. As a **French reviewer**, I want an exhaustiveness test that fails when a surface forgets
    localization, so that the invisible-failure mode is visible in CI.

### Success measures

| Story # | Measure |
|---|---|
| 1–7, 13 | Zero French strings for an `en` caller across all program/history/stats/card surfaces (golden-fixture test per surface) |
| 2, 10 | Existing fixtures render `en` with no migration and no re-save |
| 8, 9 | Locale resolution covered by a unit test on the full precedence chain |
| 14 | Session path performs no additional network request (query-count diff in test) |
| 16 | A deliberately un-localized surface fails the exhaustiveness test |

---

## Scope

**In scope:**
1. `catalogLookup` carries `name_en`; the canonical `name_snapshot` write is unchanged.
2. Add a documented `locale` argument to every MCP tool that emits user-visible names —
   `create_program`, `create_workout_day`, `get_upcoming_workouts`, `get_workout_history`,
   `get_training_stats`, `get_program_details`, `search_exercises`, `resolve_exercises` —
   optional, with the shared precedence chain. Public interface → ADR + tests +
   `file:skills/gymlogic-mcp/SKILL.md` update.
3. Display-time resolution in every formatter: `displayExerciseName`, `formatWorkoutDay`,
   history, stats, AMRAP gloss; `programPatchCard` + `updateProgram` pass the card locale;
   `dayCardItems` / `DayCard` keep the `name_en` they already fetch.
4. Localize the hardcoded French warnings **in the tool markdown** for non-UI clients
   (`formatActiveCycleWarning`, `formatSlotDetachmentWarning`) and `formatAmrapScoreLines`,
   alongside the typed `warning_details` the view already composes.
5. `get_workout_history` name filter matches in the caller's locale.
6. `muscle_group` FR canonical values are **kept** in the DB (the app already localizes them);
   only the **MCP output** is localized. **Supersedes this brief's earlier "migrate to EN
   slugs" scope item** — see Decisions.
7. Locale-aware matching **and** ranking in `search_exercises` / `resolve_exercises` (handler
   reads `user_profiles.locale`; no auth refactor).
8. One combined ADR. `localeAtom` needs no code change (already `en`); only the stale
   `CONTEXT.md` prose is corrected.
9. Exhaustiveness test + per-surface golden fixtures.

**Out of scope:**
- Transactional emails (hardcoded English; own issue, ADR 0010 §38).
- Any change to what gets written into the **Catalog Snapshot** for **names** (ADR 0010
  invariant: `name_snapshot` is a display preference and stays frozen; `exercise_name_snapshot`
  untouched).
- Localizing third-party provider / model names (branding rule).

---

## Success Criteria

- **Numeric:** an `en` caller sees **0** French exercise names / muscle groups / chrome strings
  across all in-scope surfaces, proven by golden fixtures; locale resolution precedence
  covered by a unit test; the session path adds **0** network requests.
- **Qualitative:** a French reviewer can trust CI to catch a surface that forgets localization;
  a French athlete's experience is byte-identical to today.

---

## Decisions locked in refinement

- **MCP `locale` argument:** every name-emitting tool (read **and** write), optional, shared
  precedence chain **explicit arg → `user_profiles.locale` seed → `en`**. The host locale
  (`HostContext.locale`) stays a client-only fallback, as in ADR 0031/#677 — the server
  cannot read it.
- **`muscle_group` — REVERSAL:** the brief first asked to migrate `muscle_group` to English
  slugs; exploration showed the app already localizes those labels (`catalog.muscles.*`,
  `muscleLabel()` in ~20 surfaces), so the only leak is **MCP output**. Scope narrowed to
  localizing the MCP output — the 11-migration / 3-taxonomy-list / snapshot blast radius is
  not entered. ADR 0035 must record this reversal.
- **`localeAtom` — REVERSAL:** the brief first listed a code change to align `localeAtom`
  with `fallbackLng`; `file:src/store/atoms.ts` already defaults to
  `detectLocale(navigator.language) ?? "en"`. Scope narrowed to a `CONTEXT.md` prose fix.
  ADR 0035 records it (nothing to reverse in code).
- **`search_exercises` / `resolve_exercises` ranking:** in scope (contradicts ADR 0010 §37,
  which deferred it to a phase gated on an audit script); the **tool handler** reads
  `user_profiles.locale` (the existing pattern) — no auth-path refactor.
- **Warnings:** both layers localized — the typed `warning_details` the view composes (per
  #677) **and** the tool's markdown `warnings[]` for non-UI clients.
- **Transactional emails:** out — own issue (ADR 0010 §38).
- **ADR:** one combined ADR covering display localization, the MCP `locale` argument, search
  ranking, and the two recorded reversals (`muscle_group`, `localeAtom`).
- **Ticket granularity:** one ticket per scope section (A–G + ADR + tests), decided at split time.

## Known gaps to resolve in the Tech Plan

- Precedence chain for the `locale` argument on a **write** tool (`create_program`): resolved
  in the Tech Plan — writes accept it too, but only for the dry-run `rendered` echo.
- The `_shared/programDraft.ts` mixed-language prompt context (issue §E) — resolved in the Tech
  Plan as an accepted limitation (names reach the LLM as context only; output uses the catalog
  `name_en`).
- The MCP auth profile read: cost, caching, and whether it is one query per tool call.
