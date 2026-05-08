import { afterEach, describe, expect, it, vi } from "vitest"
import { isEmbeddedAgentEnabled } from "./featureFlags"

describe("isEmbeddedAgentEnabled", () => {
  // T123 cutover: the flag flipped from default-off (only "true" enabled) to
  // default-on (only the explicit kill switch "false" disables). The new
  // contract is "absence = on" so prod doesn't need any env var to ship the
  // Embedded Agent — and the kill switch is one variable to rollback.
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns true when the env var is unset (default-on as of T123)", () => {
    vi.stubEnv("VITE_FEATURE_EMBEDDED_AGENT", "")
    expect(isEmbeddedAgentEnabled()).toBe(true)
  })

  it("returns true when VITE_FEATURE_EMBEDDED_AGENT is the string 'true'", () => {
    vi.stubEnv("VITE_FEATURE_EMBEDDED_AGENT", "true")
    expect(isEmbeddedAgentEnabled()).toBe(true)
  })

  it("returns true for any non-'false' value (defensive — no typo locks users out)", () => {
    vi.stubEnv("VITE_FEATURE_EMBEDDED_AGENT", "1")
    expect(isEmbeddedAgentEnabled()).toBe(true)
  })

  it("returns false ONLY when VITE_FEATURE_EMBEDDED_AGENT is the literal string 'false' (kill switch)", () => {
    vi.stubEnv("VITE_FEATURE_EMBEDDED_AGENT", "false")
    expect(isEmbeddedAgentEnabled()).toBe(false)
  })
})
