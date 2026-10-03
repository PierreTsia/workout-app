import { describe, it, expect } from "vitest"

/**
 * T274 moved the feedback form off the vendored shadcn form/input/textarea
 * primitives and onto the Nomos core (`Field`/`Input`/`Textarea`). The rest of
 * `src/components/ui/*` still serves the app (Button, MultiSelect, Separator
 * stay), so only the migrated primitives are pinned here: a stray re-import
 * would quietly put two visual languages on the same sheet, invisible in a diff.
 */
const sources = import.meta.glob(
  ["../components/feedback/FeedbackForm.tsx"],
  { query: "?raw", eager: true, import: "default" },
) as Record<string, string>

const paths = Object.keys(sources)

describe("feedback form on the Nomos core", () => {
  it("collects exactly the file the ticket migrated", () => {
    expect(paths).toEqual(["../components/feedback/FeedbackForm.tsx"])
  })

  it.each(paths)("no longer imports the vendored form primitives in %s", (path) => {
    const source = sources[path]
    expect(source).not.toMatch(/@\/components\/ui\/form["']/)
    expect(source).not.toMatch(/@\/components\/ui\/input["']/)
    expect(source).not.toMatch(/@\/components\/ui\/textarea["']/)
    expect(source).not.toMatch(/@\/components\/ui\/select["']/)
  })

  it("builds the form fields from the core", () => {
    expect(sources[paths[0]]).toMatch(/@nomosui\/react/)
  })
})
