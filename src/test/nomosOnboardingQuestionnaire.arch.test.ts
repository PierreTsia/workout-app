import { describe, it, expect } from "vitest"

/**
 * T275 moved the onboarding questionnaire off the vendored shadcn form/input
 * primitives and onto the Nomos core (`Field`/`Input`). The rest of
 * `src/components/ui/*` still serves the app (Button, ToggleGroup, Alert stay),
 * so only the migrated primitives are pinned here: a stray re-import would
 * quietly put two visual languages on the same sheet, invisible in a diff.
 */
const sources = import.meta.glob(
  [
    "../components/onboarding/QuestionnaireStep.tsx",
    "../components/onboarding/QuestionnaireTrainingFields.tsx",
  ],
  { query: "?raw", eager: true, import: "default" },
) as Record<string, string>

const paths = Object.keys(sources).sort()
const trainingFieldsPath = "../components/onboarding/QuestionnaireTrainingFields.tsx"

describe("onboarding questionnaire on the Nomos core", () => {
  it("collects exactly the files the ticket migrated", () => {
    expect(paths).toEqual([
      "../components/onboarding/QuestionnaireStep.tsx",
      "../components/onboarding/QuestionnaireTrainingFields.tsx",
    ])
  })

  it.each(paths)("no longer imports the vendored form primitives in %s", (path) => {
    const source = sources[path]
    expect(source).not.toMatch(/@\/components\/ui\/form["']/)
    expect(source).not.toMatch(/@\/components\/ui\/input["']/)
    expect(source).not.toMatch(/@\/components\/ui\/select["']/)
  })

  it("builds the training fields from the core `Field`", () => {
    expect(sources[trainingFieldsPath]).toMatch(/@nomosui\/react/)
    expect(sources[trainingFieldsPath]).toMatch(/\bField\b/)
  })
})
