import { describe, expect, it } from "vitest"
import { publicSite } from "./publicSite"

describe("publicSite", () => {
  it("keeps every entry on the docs.gymlogic.me host", () => {
    Object.values(publicSite).forEach((url) => {
      expect(url).toMatch(/^https:\/\/docs\.gymlogic\.me(\/.*)?$/)
    })
  })

  it("exposes the named entries the bridges depend on", () => {
    expect(publicSite).toEqual(
      expect.objectContaining({
        home: expect.any(String),
        about: expect.any(String),
        connectClaude: expect.any(String),
      }),
    )
  })
})
