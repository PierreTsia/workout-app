# T200 — Search punch-through from Exercises

## Goal

Typing `cindy` / `holland` / `tom holland` from **Exercises** pins the Cindy card above muscle groups without switching kind. Empty Exercises query stays a movement catalog (no promo). Circuits list uses the same matcher. Stories 3, 4.

## Mode

**AFK** — match rules are locked (≥ 2 chars, slug/alias prefix, tagline includes).

## Slice

`seedMatchesQuery` → pin region in `ExerciseLibraryPicker` (Exercises kind) + filter Circuits list → vitest

## Dependencies

T199 (kind toggle, `useBenchmarkSeeds`, `CircuitSeedCard`, instantiate tap).

## Scope

### Matcher — `file:src/lib/seedSearch.ts`

- `seedMatchesQuery(row, query)`: trim, lowercase. If query length `< 2` → `false`.
- Match if slug or any alias **starts with** the query, **or** `tagline_fr` / `tagline_en` **includes** the query.
- No RPC. Client-only on the T199 seed list.

### Picker — `file:src/components/builder/ExerciseLibraryPicker.tsx`

- **Exercises + empty query:** no cards (story 3). Muscle groups as today.
- **Exercises + matching query:** matching `CircuitSeedCard`s **above** `CommandGroup`s; kind stays Exercises; exercise filters still apply only to exercises.
- **Circuits + query:** same matcher filters the seed list (T199 showed all seeds).
- Tap on a pinned card = same instantiate path as T199.
- Do not auto-switch kind.

## Out of Scope

- Changing instantiate, seed fetch, or Create circuit.
- Home CTA, `/library`, pre-session.
- Min-length or match-rule bikeshedding (locked).
- Remembering last kind tab.

## Acceptance Criteria

- [ ] On Exercises, query `""` or `"c"`: 0 seed cards.
- [ ] On Exercises, query `cindy` / `ci` / `holland` / `ho` / `tom holland`: Cindy card pinned above muscle groups; kind remains Exercises.
- [ ] Tagline substring (e.g. `holland` in EN tagline) matches; muscle/equipment filters do not hide the pin.
- [ ] On Circuits, the same query filters the list (no match → empty copy, toggle still visible).
- [ ] Tap on a pinned card still instantiates (T199 behavior).
- [ ] Vitest: `seedMatchesQuery` table (`c` false, `ci` / `ho` / `HOLLAND` true); picker: empty Exercises has no pin; `cindy` shows the card above groups.

## References

- Epic Brief stories 3, 4
- Tech Plan Key Decisions (punch-through, match) + `file:src/lib/seedSearch.ts`
- T199 picker / `CircuitSeedCard`
