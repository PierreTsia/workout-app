import { describe, expect, it } from "vitest"
import { versionResponse } from "./versionRoute"

describe("versionResponse", () => {
  it("returns the version payload for the /version route", () => {
    expect(versionResponse("/functions/v1/mcp/version", "1.2.3")).toEqual({
      version: "1.2.3",
    })
  })

  it("returns null for another path", () => {
    expect(versionResponse("/functions/v1/mcp", "1.2.3")).toBeNull()
  })

  it("does not match a path that ends with 'versions'", () => {
    expect(versionResponse("/functions/v1/mcp/versions", "1.2.3")).toBeNull()
  })
})
