import { describe, expect, it } from "vitest"
import { sequenceItemBadge } from "./sequenceItemBadge"

describe("sequenceItemBadge", () => {
  it("counts four Circuits as four sequence items, not flattened stations", () => {
    const badge = sequenceItemBadge(0, 4)

    expect(badge.kind).toBe("circuits")
    expect(badge.circuits).toBe(4)
    expect(badge.solos).toBe(0)
  })

  it("counts six solos as a solos-only badge", () => {
    const badge = sequenceItemBadge(6, 0)

    expect(badge.kind).toBe("solos")
    expect(badge.solos).toBe(6)
    expect(badge.circuits).toBe(0)
  })

  it("marks a day with both Circuits and solos as mixed", () => {
    const badge = sequenceItemBadge(3, 2)

    expect(badge.kind).toBe("mixed")
    expect(badge.circuits).toBe(2)
    expect(badge.solos).toBe(3)
  })

  it("marks a day with no sequence items as empty", () => {
    const badge = sequenceItemBadge(0, 0)

    expect(badge.kind).toBe("empty")
    expect(badge.circuits).toBe(0)
    expect(badge.solos).toBe(0)
  })
})
