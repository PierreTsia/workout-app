import { describe, it, expect } from "vitest"

/**
 * T279 moved the generator's field primitives off the vendored shadcn
 * `input`/`textarea`/`select` and onto the Nomos core (`Input`/`Textarea`).
 * The rest of `src/components/ui/*` still serves the generator, so only the
 * migrated primitives are pinned here: a stray re-import would quietly put two
 * visual languages on the same surface, invisible in a diff. Generator state
 * and AI logic are untouched — only the field source changes.
 */
const sources = import.meta.glob(
  [
    "../components/generator/ConstraintStep.tsx",
    "../components/generator/ExerciseAddPicker.tsx",
    "../components/generator/PreviewStep.tsx",
    "../components/generator/SaveAsProgramPrompt.tsx",
  ],
  { query: "?raw", eager: true, import: "default" },
) as Record<string, string>

const paths = Object.keys(sources).sort()

describe("program generator on the Nomos core", () => {
  it("collects exactly the four files the ticket migrated", () => {
    expect(paths).toEqual([
      "../components/generator/ConstraintStep.tsx",
      "../components/generator/ExerciseAddPicker.tsx",
      "../components/generator/PreviewStep.tsx",
      "../components/generator/SaveAsProgramPrompt.tsx",
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
