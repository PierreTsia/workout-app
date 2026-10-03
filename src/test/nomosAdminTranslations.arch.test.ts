import { describe, it, expect } from "vitest"

/**
 * T282 closes the admin translation residuals: `TranslationReviewCard` and
 * `ReviewAssistDialog` move off the vendored shadcn `badge`/`button`/
 * `textarea`/`dialog` and onto the Nomos core. The rest of
 * `src/components/ui/*` still serves the app, so a stray re-import here would
 * put two visual languages on the same review screen — invisible in a diff,
 * caught here.
 */
const sources = import.meta.glob(
  [
    "../components/admin/translations/TranslationReviewCard.tsx",
    "../components/admin/translations/ReviewAssistDialog.tsx",
  ],
  { query: "?raw", eager: true, import: "default" },
) as Record<string, string>

const paths = Object.keys(sources).sort()
const cardPath = "../components/admin/translations/TranslationReviewCard.tsx"
const dialogPath = "../components/admin/translations/ReviewAssistDialog.tsx"

describe("admin translation residuals on the Nomos core", () => {
  it("collects exactly the two files the ticket migrated", () => {
    expect(paths).toEqual([dialogPath, cardPath])
  })

  it.each(paths)("no longer imports the vendored primitives in %s", (path) => {
    expect(sources[path]).not.toMatch(
      /@\/components\/ui\/(badge|button|textarea|dialog)["']/,
    )
  })

  it("builds the review card from the core badge, button and textarea", () => {
    expect(sources[cardPath]).toMatch(/@nomosui\/react/)
    expect(sources[cardPath]).toMatch(/\bBadge\b/)
    expect(sources[cardPath]).toMatch(/\bButton\b/)
    expect(sources[cardPath]).toMatch(/\bTextarea\b/)
  })

  it("builds the assist dialog from the core textarea and dialog", () => {
    expect(sources[dialogPath]).toMatch(/@nomosui\/react/)
    expect(sources[dialogPath]).toMatch(/\bTextarea\b/)
    expect(sources[dialogPath]).toMatch(/\bDialog\b/)
  })
})
