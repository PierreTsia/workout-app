import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { isIOS, isStandalone } from "./platform"

describe("platform detection", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", { userAgent: "" })
    vi.stubGlobal("window", {
      matchMedia: vi.fn().mockReturnValue({ matches: false }),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe("isIOS", () => {
    it("returns true for iPhone user agent", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
      })
      expect(isIOS()).toBe(true)
    })

    it("returns true for iPad user agent", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
      })
      expect(isIOS()).toBe(true)
    })

    it("returns true for iPod user agent", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (iPod; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
      })
      expect(isIOS()).toBe(true)
    })

    it("returns false for Android user agent", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/114.0.0.0 Mobile Safari/537.36",
      })
      expect(isIOS()).toBe(false)
    })

    it("returns false for desktop Chrome user agent", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/114.0.0.0 Safari/537.36",
      })
      expect(isIOS()).toBe(false)
    })

    it("returns false when MSStream is present (IE mobile)", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
      })
      vi.stubGlobal("window", {
        MSStream: {},
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
      })
      expect(isIOS()).toBe(false)
    })
  })

  describe("isStandalone", () => {
    it("returns true when display-mode is standalone", () => {
      vi.stubGlobal("window", {
        matchMedia: vi.fn().mockReturnValue({ matches: true }),
      })
      expect(isStandalone()).toBe(true)
    })

    it("returns false when display-mode is not standalone", () => {
      vi.stubGlobal("window", {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
      })
      expect(isStandalone()).toBe(false)
    })
  })
})
