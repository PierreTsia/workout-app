import { describe, expect, it } from "vitest"
import {
  addIsoDays,
  priorWindowRange,
  profileWindowRange,
  snapshotHorizon,
  snapshotPrefetchRange,
} from "./windowRange"

describe("snapshot prefetch windows", () => {
  it("covers 7/30/100 plus an equal prior window with one 200d fetch", () => {
    expect(snapshotHorizon("7")).toBe(200)
    expect(snapshotHorizon("30")).toBe(200)
    expect(snapshotHorizon("100")).toBe(200)
    expect(snapshotPrefetchRange(200, "2026-08-21")).toEqual({
      from: addIsoDays("2026-08-21", -199),
      to: "2026-08-21",
    })
    const hundred = profileWindowRange("100", "2026-08-21")
    expect(priorWindowRange(hundred.from, hundred.to).from).toBe(
      addIsoDays("2026-08-21", -199),
    )
  })

  it("covers 1y plus an equal prior window with one 730d fetch", () => {
    expect(snapshotHorizon("365")).toBe(730)
    expect(snapshotPrefetchRange(730, "2026-08-21")).toEqual({
      from: addIsoDays("2026-08-21", -729),
      to: "2026-08-21",
    })
    const year = profileWindowRange("365", "2026-08-21")
    expect(priorWindowRange(year.from, year.to).from).toBe(
      addIsoDays("2026-08-21", -729),
    )
  })

  it("does not prefetch a lifetime dump on All time", () => {
    expect(snapshotHorizon("all")).toBeNull()
  })
})
