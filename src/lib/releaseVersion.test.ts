import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fetchReleaseVersion, GITHUB_RELEASES_URL } from "./releaseVersion"

describe("fetchReleaseVersion", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://proj.supabase.co")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("returns the version on a 2xx JSON response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ version: "1.2.3" }) })
    vi.stubGlobal("fetch", fetchMock)

    await expect(fetchReleaseVersion()).resolves.toBe("1.2.3")
    expect(fetchMock).toHaveBeenCalledWith(
      "https://proj.supabase.co/functions/v1/mcp/version",
    )
  })

  it("returns null on a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }),
    )
    await expect(fetchReleaseVersion()).resolves.toBeNull()
  })

  it("returns null when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
    await expect(fetchReleaseVersion()).resolves.toBeNull()
  })

  it("returns null when the version field is not a non-empty string", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version: 42 }) }),
    )
    await expect(fetchReleaseVersion()).resolves.toBeNull()
  })

  it("returns null without calling fetch when VITE_SUPABASE_URL is absent", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "")
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await expect(fetchReleaseVersion()).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("GITHUB_RELEASES_URL", () => {
  it("points at the repository releases", () => {
    expect(GITHUB_RELEASES_URL).toBe(
      "https://github.com/PierreTsia/workout-app/releases",
    )
  })
})
