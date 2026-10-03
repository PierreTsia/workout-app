import { describe, it, expect } from "vitest"

/**
 * T276 moved the account forms off the vendored shadcn form/input primitives
 * and onto the Nomos core (`Form`/`Field`/`Input`). The rest of
 * `src/components/ui/*` still serves the app (Button, Select, Dialog,
 * AlertDialog stay), so only the migrated primitives are pinned here: a stray
 * re-import would quietly put two visual languages on the same sheet,
 * invisible in a diff.
 */
const sources = import.meta.glob(
  [
    "../pages/AccountPage.tsx",
    "../components/account/AccountValidationMessage.tsx",
    "../components/account/CreatePATDialog.tsx",
  ],
  { query: "?raw", eager: true, import: "default" },
) as Record<string, string>

const paths = Object.keys(sources).sort()

describe("account forms on the Nomos core", () => {
  it("collects exactly the files the ticket migrated", () => {
    expect(paths).toEqual([
      "../components/account/AccountValidationMessage.tsx",
      "../components/account/CreatePATDialog.tsx",
      "../pages/AccountPage.tsx",
    ])
  })

  it.each(paths)("no longer imports the vendored form primitives in %s", (path) => {
    const source = sources[path]
    expect(source).not.toMatch(/@\/components\/ui\/form["']/)
    expect(source).not.toMatch(/@\/components\/ui\/input["']/)
  })
})
