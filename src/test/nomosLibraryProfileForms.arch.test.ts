import { describe, it, expect } from "vitest"

/**
 * T281 moved the library create-program dialog, the exercise library search and
 * the profile window picker off the vendored shadcn `input`/`textarea`/`select`
 * and onto the Nomos core (`Input`/`Select`). The rest of `src/components/ui/*`
 * still serves these surfaces (Dialog and, on Profile, the vendored
 * `TooltipProvider` stay until their own migration), so only the migrated field
 * primitives are pinned here: a stray re-import would quietly put two visual
 * languages on the same screen, invisible in a diff.
 */
const sources = import.meta.glob(
  [
    "../components/library/CreateProgramDialog.tsx",
    "../pages/library/ExerciseLibraryPage.tsx",
    "../pages/ProfilePage.tsx",
  ],
  { query: "?raw", eager: true, import: "default" },
) as Record<string, string>

const paths = Object.keys(sources).sort()
const dialogPath = "../components/library/CreateProgramDialog.tsx"
const libraryPath = "../pages/library/ExerciseLibraryPage.tsx"
const profilePath = "../pages/ProfilePage.tsx"

describe("library + profile forms on the Nomos core", () => {
  it("collects exactly the three files the ticket migrated", () => {
    expect(paths).toEqual([dialogPath, profilePath, libraryPath])
  })

  it.each(paths)("no longer imports the vendored field primitives in %s", (path) => {
    const source = sources[path]
    expect(source).not.toMatch(/@\/components\/ui\/input["']/)
    expect(source).not.toMatch(/@\/components\/ui\/textarea["']/)
    expect(source).not.toMatch(/@\/components\/ui\/select["']/)
  })

  it("builds the create-program name field from the core `Input`", () => {
    expect(sources[dialogPath]).toMatch(/@nomosui\/react/)
    expect(sources[dialogPath]).toMatch(/\bInput\b/)
  })

  it("builds the library search field from the core `Input`", () => {
    expect(sources[libraryPath]).toMatch(/@nomosui\/react/)
    expect(sources[libraryPath]).toMatch(/\bInput\b/)
  })

  it("builds the profile window picker from the core `Select`", () => {
    expect(sources[profilePath]).toMatch(/@nomosui\/react/)
    expect(sources[profilePath]).toMatch(/\bSelect\b/)
  })
})
