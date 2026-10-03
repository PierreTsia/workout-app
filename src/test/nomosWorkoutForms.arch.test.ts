import { describe, it, expect } from "vitest"

/**
 * T280 moved the workout surface's field primitives off the vendored shadcn
 * `input`/`textarea`/`select` and onto the Nomos core (`Input`). The rest of
 * `src/components/ui/*` still serves the workout screens (Button, Checkbox,
 * Sheet, Drawer, ToggleGroup stay), so only the migrated primitive is pinned
 * here: a stray re-import would quietly put two visual languages on the same
 * surface, invisible in a diff. Session/timer/progression logic is untouched —
 * only the field source changes.
 */
const sources = import.meta.glob(
  [
    "../components/workout/SessionNote.tsx",
    "../components/workout/SetsTable.tsx",
    "../components/workout/DurationSetTimer.tsx",
    "../components/workout/SwapExerciseSheet.tsx",
    "../components/workout/DeviationReasonSheet.tsx",
  ],
  { query: "?raw", eager: true, import: "default" },
) as Record<string, string>

const paths = Object.keys(sources).sort()

describe("workout forms on the Nomos core", () => {
  it("collects exactly the five files the ticket migrated", () => {
    expect(paths).toEqual([
      "../components/workout/DeviationReasonSheet.tsx",
      "../components/workout/DurationSetTimer.tsx",
      "../components/workout/SessionNote.tsx",
      "../components/workout/SetsTable.tsx",
      "../components/workout/SwapExerciseSheet.tsx",
    ])
  })

  it.each(paths)("no longer imports the vendored field primitives in %s", (path) => {
    const source = sources[path]
    expect(source).not.toMatch(/@\/components\/ui\/input["']/)
    expect(source).not.toMatch(/@\/components\/ui\/textarea["']/)
    expect(source).not.toMatch(/@\/components\/ui\/select["']/)
  })

  it.each(paths)("builds its fields from the core in %s", (path) => {
    expect(sources[path]).toMatch(/@nomosui\/react/)
  })
})
