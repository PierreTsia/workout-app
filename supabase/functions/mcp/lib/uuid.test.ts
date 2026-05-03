import { describe, expect, it } from "vitest"
import { isUuid, UUID_RE } from "./uuid"

describe("isUuid", () => {
  it("accepts a canonical lowercase UUID-shaped string", () => {
    expect(isUuid("a3f0c4e5-1234-4abc-9def-012345678901")).toBe(true)
  })

  it("accepts an uppercase UUID-shaped string (case-insensitive contract)", () => {
    expect(isUuid("A3F0C4E5-1234-4ABC-9DEF-012345678901")).toBe(true)
  })

  it("rejects an empty string", () => {
    expect(isUuid("")).toBe(false)
  })

  it("rejects an arbitrary non-UUID string", () => {
    expect(isUuid("not-a-uuid")).toBe(false)
  })
})

describe("UUID_RE", () => {
  it("is the same regex used by isUuid (exposed for callers that need to test by regex directly)", () => {
    expect(UUID_RE.test("a3f0c4e5-1234-4abc-9def-012345678901")).toBe(true)
    expect(UUID_RE.test("nope")).toBe(false)
  })
})
