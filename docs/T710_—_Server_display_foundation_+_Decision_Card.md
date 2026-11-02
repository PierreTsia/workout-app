# T710 — Server display foundation + Decision Card

## Goal

Ship the shared server-side localization foundation and make the **Decision Card** the first
surface that proves it end-to-end: an English agent receives English exercise names and
English warnings. This is the foundation every later ticket imports (`displayLabels.ts`,
`locale.ts`, `name_en` on the catalog wire).

Addresses Epic Brief stories: **6** (Decision Card), **8, 9** (locale contract), **13**
(no mixed language).

## Mode

AFK.

## Slice

`file:supabase/functions/mcp/lib/catalogLookup.ts` → `programPersistence.ts` →
`lib/daySequence.ts` → `lib/displayLabels.ts` (new) → `lib/locale.ts` (new) →
`lib/format.ts` → `programPatchCard.ts` →
`src/mcp-views/program-patch/ProgramPatchCard.tsx` → golden fixture.

## Dependencies

T709 (ADR 0035).

## Scope

### 1. `name_en` on the catalog wire

- `file:supabase/functions/mcp/lib/catalogLookup.ts:56` — add `name_en` to `CATALOG_COLUMNS`.
- `file:supabase/functions/mcp/lib/programPersistence.ts:49-57` — add `name_en` (nullable) to
  `CatalogExerciseForProgram`.
- `file:supabase/functions/mcp/lib/daySequence.ts:89-90` — carry `name_en` where catalog rows
  are read (consumed by T711/T712).

### 2. `displayLabels.ts` (new)

Pure module, the server twin of `file:src/lib/catalogLabels.ts`:

```ts
resolveDisplayName(ex: { name?: string|null; name_en?: string|null; name_snapshot?: string|null },
                   locale: "en"|"fr"): string
// en → name_en ?? name ?? name_snapshot ; fr → name ?? name_snapshot ?? name_en
muscleLabel(value: string|null, locale: "en"|"fr"): string
// 13 canonical FR → EN pairs (mirror en/catalog.json); passthrough otherwise
warningText(kind: "active_cycle"|"slot_detachment", locale, vars): string
```

### 3. `locale.ts` (new)

```ts
readProfileLocale(supabase): Promise<unknown>            // user_profiles.select("locale").maybeSingle()
resolveToolLocale(args, profile): "en"|"fr"              // asCardLocale(arg) ?? asCardLocale(profile) ?? "en"
```

Reuses `asCardLocale` / `resolveCardLocale` from `file:supabase/functions/mcp/lib/sessionCard.ts`.

### 4. Refactor `sessionCard.ts` onto the helper

`sessionCard.ts:256` already picks `locale === "fr" ? name : name_en ?? name`; repoint it to
`resolveDisplayName` so there is one server rule.

### 5. Decision Card + `update_program` markdown

- `file:supabase/functions/mcp/lib/programPatchCard.ts:97,188` — use `resolveDisplayName(catalog, locale)`.
- `:66` — `warning_details.slot_detachment.exercise` carries the localized name.
- `file:supabase/functions/mcp/tools/updateProgram.ts:398` — thread the card locale into the formatter.
- `file:supabase/functions/mcp/lib/format.ts:709,746` — `renderParsedLine` / `renderCurrentLine`
  take the locale; `format.ts:645,657` warnings are replaced by `warningText(kind, locale, vars)`,
  so the tool's markdown `warnings[]` is no longer French for a non-UI client.
- View: `ProgramPatchCard.tsx:165` renders the name already localized by the server — no view change beyond confirming the payload locale flows.

## Out of Scope

- Read/format tools beyond the card (T711); write tools (T712); DayCard (T713); ranking (T715).
- Any change to what is written into `name_snapshot` / `exercise_name_snapshot`.

## Acceptance Criteria

- [ ] `resolveDisplayName` unit test covers `en`/`fr` and the snapshot fallback.
- [ ] `muscleLabel` unit test covers all 13 pairs + an off-taxonomy passthrough.
- [ ] An `en` caller's Decision Card shows EN exercise names and EN warnings (golden fixture through `programPatchCard`).
- [ ] An `en` caller's `update_program` markdown `warnings[]` is EN (non-UI client fixture).
- [ ] A `fr` caller's Decision Card and warnings are unchanged vs today (golden fixture).
- [ ] The persisted patch/payload contains no `locale` key (test).
- [ ] `sessionCard.ts` uses `resolveDisplayName`; existing session-card tests stay green.

## References

- Tech Plan `file:docs/Tech_Plan_—_Locale_end-to-end_#729.md` (Component Architecture; i18n contract)
- ADR `file:docs/adr/0010-localize-catalog-at-display-time.md`
- Tech Plan `file:docs/Tech_Plan_—_Decision_Card_locale_#677.md`
