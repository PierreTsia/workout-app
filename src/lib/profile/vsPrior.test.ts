import { describe, expect, it } from "vitest"
import { vsPriorDelta, vsPriorMagnitude } from "./vsPrior"

describe("vsPriorMagnitude", () => {
  it("strips a signed number so i18n does not paint --3", () => {
    expect(vsPriorMagnitude(-3)).toBe(3)
    expect(vsPriorMagnitude(3)).toBe(3)
    expect(vsPriorMagnitude("-3")).toBe("3")
    expect(vsPriorMagnitude("--3")).toBe("3")
    expect(vsPriorMagnitude("1h 20")).toBe("1h 20")
  })
})

describe("vsPriorDelta", () => {
  const t = (key: string, opts?: Record<string, string | number>) => {
    if (key === "pulse.deltaEven") return "even vs prior"
    if (key === "pulse.deltaDown") return `-${opts?.n} vs prior`
    return `+${opts?.n} vs prior`
  }

  it("interpolates the absolute magnitude into the signed copy", () => {
    expect(vsPriorDelta(t, -3).label).toBe("-3 vs prior")
    expect(vsPriorDelta(t, -3, -3).label).toBe("-3 vs prior")
    expect(vsPriorDelta(t, 3).label).toBe("+3 vs prior")
    expect(vsPriorDelta(t, 0).label).toBe("even vs prior")
  })
})
