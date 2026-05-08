import { afterEach, describe, expect, it, vi } from "vitest"
import { isEmbeddedAgentEnabled } from "./featureFlags"

describe("isEmbeddedAgentEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns true when VITE_FEATURE_EMBEDDED_AGENT is the string 'true'", () => {
    vi.stubEnv("VITE_FEATURE_EMBEDDED_AGENT", "true")
    expect(isEmbeddedAgentEnabled()).toBe(true)
  })

  it("returns false when the env var is unset", () => {
    vi.stubEnv("VITE_FEATURE_EMBEDDED_AGENT", "")
    expect(isEmbeddedAgentEnabled()).toBe(false)
  })

  it("returns false for any non-'true' value", () => {
    vi.stubEnv("VITE_FEATURE_EMBEDDED_AGENT", "1")
    expect(isEmbeddedAgentEnabled()).toBe(false)
  })
})
