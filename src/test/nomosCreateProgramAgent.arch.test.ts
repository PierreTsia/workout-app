import { describe, it, expect } from "vitest"

/**
 * T277 moved the create-program blank step and the embedded-agent chat step
 * off the vendored shadcn form/input/textarea primitives and onto the Nomos
 * core (`Field`/`Input`/`Textarea`). The rest of `src/components/ui/*` still
 * serves the app (Button, Card, Badge, Alert, AlertDialog stay), so only the
 * migrated primitives are pinned here: a stray re-import would quietly put two
 * visual languages on the same surface, invisible in a diff.
 */
const sources = import.meta.glob(
  [
    "../components/create-program/BlankProgramStep.tsx",
    "../components/embedded-agent/EmbeddedAgentChatStep.tsx",
  ],
  { query: "?raw", eager: true, import: "default" },
) as Record<string, string>

const paths = Object.keys(sources).sort()
const blankPath = "../components/create-program/BlankProgramStep.tsx"
const chatPath = "../components/embedded-agent/EmbeddedAgentChatStep.tsx"

describe("create-program + embedded agent on the Nomos core", () => {
  it("collects exactly the files the ticket migrated", () => {
    expect(paths).toEqual([blankPath, chatPath])
  })

  it.each(paths)("no longer imports the vendored form primitives in %s", (path) => {
    const source = sources[path]
    expect(source).not.toMatch(/@\/components\/ui\/form["']/)
    expect(source).not.toMatch(/@\/components\/ui\/input["']/)
    expect(source).not.toMatch(/@\/components\/ui\/textarea["']/)
  })

  it("builds the blank step from the core `Field`", () => {
    expect(sources[blankPath]).toMatch(/@nomosui\/react/)
    expect(sources[blankPath]).toMatch(/\bField\b/)
  })

  it("builds the chat composer from the core `Input`/`Textarea`", () => {
    expect(sources[chatPath]).toMatch(/@nomosui\/react/)
    expect(sources[chatPath]).toMatch(/\bTextarea\b/)
  })
})
