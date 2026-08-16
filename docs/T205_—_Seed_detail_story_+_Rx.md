# T205 — Seed detail: story + Rx + 404

## Goal

`/library/circuits/:slug` is the encyclopedia body: `label`, **BenchmarkStoryHeader**, frozen Rx stations with localized names. Unknown / non-seed slugs 404. No history list yet (T206). Stories 4–5, 10.

## Mode

**AFK** — copy fields and Rx JSONB shape are locked. No design fork.

## Slice

`useBenchmarkSeed(slug)` → `CircuitCatalogSeedPage` → `BenchmarkStoryHeader` + `CircuitRxList` → vitest

## Dependencies

T204 (list links here). Unblocks T206.

## Scope

### Hook

- `file:src/hooks/useBenchmarkSeed.ts`
- Select `id, slug, label, rx, tagline_fr, tagline_en, story_fr, story_en, reference`
- `.eq("slug", slug).is("owner_id", null).maybeSingle()`
- Parse with the same Rx guard as `parseCatalogPreviewRow` (extend that parser or a sibling so story/reference are included — do not `as` cast)
- `enabled` when slug is a non-empty string
- Mock supabase in tests: seed hit; `owner_id` leak must not happen because of `.is("owner_id", null)`; missing → null

### Page

- Replace T204 stub
- Back to `/library/circuits`
- Heading = `label` (emoji included)
- `BenchmarkStoryHeader` from hook copy (tagline, story, `reference` beat)
- `CircuitRxList`: `amount` + `useCatalogLabels().exerciseName` via `fetchExercisesByIds` on `rx.exercises[].exercise_id`
- Loading / not-found (`library:circuitNotFound` + back to list)
- Never import instantiate helpers

### i18n

- `library:circuitNotFound`, `library:circuitDetailLoading`, `library:circuitBrowseBack` (back to Circuits list)

## Out of Scope

- AMRAP run list / PB (T206)
- Instantiate, add-to-day, picker Info
- Editorial Olympien grouping

## Acceptance Criteria

- [ ] `/library/circuits/cindy` shows label `Cindy`, Holland tagline/story/`reference` beat when the seed row has them
- [ ] Rx lists three stations with catalog names (not raw UUIDs) and catalog amounts
- [ ] `/library/circuits/not-a-seed` and empty slug → not-found + link to `/library/circuits`
- [ ] Forks cannot be addressed (query is slug + `owner_id IS NULL`)
- [ ] No instantiate import/call on the detail page
- [ ] List → tap Zeus still lands on this page
- [ ] Vitest with stripped Supabase env green on new tests

## References

- Epic Brief stories 4–5, 10
- `file:src/components/history/BenchmarkStoryHeader.tsx`
- `file:src/lib/fetchExercisesByIds.ts`
- `file:src/lib/previewCatalogCircuit.ts` (`parseCatalogPreviewRow` / `parseRx`)
