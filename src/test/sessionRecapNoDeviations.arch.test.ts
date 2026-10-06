import { describe, it, expect } from "vitest"

/**
 * #665: the end-of-session recap no longer surfaces deviations. The
 * `SessionAdjustments` component and its two i18n keys were deleted; reviving
 * either would silently bring the section back. This guards the removal at the
 * source level — a render probe that omits the removed prop cannot fail.
 */
const removedComponent = import.meta.glob(
  "../components/workout/SessionAdjustments.tsx",
  { query: "?raw", eager: true, import: "default" },
)

// Positive control: a sibling that does exist, proving the glob reads the dir.
const siblingComponent = import.meta.glob(
  "../components/workout/SessionSummary.tsx",
  { query: "?raw", eager: true, import: "default" },
)

const localeSources = import.meta.glob("../locales/*/workout.json", {
  query: "?raw",
  eager: true,
  import: "default",
}) as Record<string, string>

const locales = Object.values(localeSources).map(
  (raw) => JSON.parse(raw) as Record<string, string>,
)

describe("session recap deviations removal (#665)", () => {
  it("no longer ships SessionAdjustments.tsx", () => {
    expect(Object.keys(siblingComponent)).toEqual([
      "../components/workout/SessionSummary.tsx",
    ])
    expect(Object.keys(removedComponent)).toEqual([])
  })

  it("reads both locale bundles (positive control)", () => {
    expect(locales).toHaveLength(2)
    for (const locale of locales) {
      expect(locale["deviation.sessionNotePlaceholder"]).toBeDefined()
    }
  })

  it("no longer carries the dead debrief i18n keys", () => {
    for (const locale of locales) {
      expect(locale["deviation.debriefTitle"]).toBeUndefined()
      expect(locale["deviation.debriefEmpty"]).toBeUndefined()
    }
  })
})
