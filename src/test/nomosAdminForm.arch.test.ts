import { describe, it, expect } from "vitest"

/**
 * T270 moved the admin exercise form off the vendored shadcn primitives and
 * onto the Nomos core (`Field`/`Form`/`Input`/…). `src/components/ui/*` still
 * serves the rest of the app, so a stray import here would silently keep two
 * visual languages on the same screen — invisible in a diff, caught here.
 */
const sources = import.meta.glob(
  [
    "../components/admin/exercise-form/ExerciseEditForm.tsx",
    "../components/admin/exercise-form/InstructionFieldArray.tsx",
    "../components/admin/exercise-form/LlmJsonImport.tsx",
    "../components/admin/review/ExerciseReviewToolbar.tsx",
    "../pages/AdminExerciseEditPage.tsx",
    "../pages/AdminReviewPage.tsx",
  ],
  { query: "?raw", eager: true, import: "default" },
) as Record<string, string>

const paths = Object.keys(sources).sort()

describe("admin exercise form on the Nomos core", () => {
  it("collects exactly the files the ticket migrated", () => {
    expect(paths).toEqual([
      "../components/admin/exercise-form/ExerciseEditForm.tsx",
      "../components/admin/exercise-form/InstructionFieldArray.tsx",
      "../components/admin/exercise-form/LlmJsonImport.tsx",
      "../components/admin/review/ExerciseReviewToolbar.tsx",
      "../pages/AdminExerciseEditPage.tsx",
      "../pages/AdminReviewPage.tsx",
    ])
  })

  it.each(paths)("no longer imports a vendored primitive in %s", (path) => {
    expect(sources[path]).not.toMatch(/@\/components\/ui\//)
  })

  it("builds the form components from the core", () => {
    const formSources = paths
      .filter((path) => path.includes("exercise-form/"))
      .map((path) => sources[path])

    expect(formSources).toHaveLength(3)
    for (const source of formSources) {
      expect(source).toMatch(/@nomosui\/react/)
    }
  })
})
