import { describe, it, expect } from "vitest"

/**
 * T278 moved the program builder's field primitives off the vendored shadcn
 * `input`/`textarea`/`select` and onto the Nomos core (`Input`/`Textarea`/
 * `Select`). The rest of `src/components/ui/*` still serves the builder
 * (Button, Switch, Label, Collapsible stay), so only the migrated primitives
 * are pinned here: a stray re-import would quietly put two visual languages on
 * the same surface, invisible in a diff. Builder logic (dnd, progression) is
 * untouched — only the field source changes.
 */
const sources = import.meta.glob(
  [
    "../components/builder/ExerciseDetailForm.tsx",
    "../components/builder/DayEditor.tsx",
    "../components/builder/ExerciseRow.tsx",
    "../components/builder/BuilderHeader.tsx",
    "../components/builder/ExerciseLibraryPicker.tsx",
    "../components/builder/BlockEditor.tsx",
    "../components/builder/PerRoundGrid.tsx",
    "../components/builder/UniformExerciseList.tsx",
  ],
  { query: "?raw", eager: true, import: "default" },
) as Record<string, string>

const paths = Object.keys(sources).sort()

describe("program builder on the Nomos core", () => {
  it("collects exactly the eight files the ticket migrated", () => {
    expect(paths).toEqual([
      "../components/builder/BlockEditor.tsx",
      "../components/builder/BuilderHeader.tsx",
      "../components/builder/DayEditor.tsx",
      "../components/builder/ExerciseDetailForm.tsx",
      "../components/builder/ExerciseLibraryPicker.tsx",
      "../components/builder/ExerciseRow.tsx",
      "../components/builder/PerRoundGrid.tsx",
      "../components/builder/UniformExerciseList.tsx",
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
