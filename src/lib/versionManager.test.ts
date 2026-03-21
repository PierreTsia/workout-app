import { describe, it, expect, beforeEach, vi } from "vitest"

// __APP_VERSION__ is injected by Vite define — we control it per-test via vi.stubGlobal.
let mockCacheStore: Map<string, true>

function stubCaches() {
  mockCacheStore = new Map()
  vi.stubGlobal("caches", {
    keys: () => Promise.resolve([...mockCacheStore.keys()]),
    delete: (name: string) => {
      mockCacheStore.delete(name)
      return Promise.resolve(true)
    },
  })
}

function setVersion(v: string) {
  vi.stubGlobal("__APP_VERSION__", v)
}

async function importFresh() {
  vi.resetModules()
  const mod = await import("./versionManager")
  return mod.handleVersionUpgrade
}

beforeEach(() => {
  localStorage.clear()
  stubCaches()
})

describe("handleVersionUpgrade", () => {
  it("stamps version on first visit without purging anything", async () => {
    setVersion("v1")
    localStorage.setItem("session", JSON.stringify({ isActive: false }))
    localStorage.setItem("some-random-key", "data")

    const handleVersionUpgrade = await importFresh()
    await handleVersionUpgrade()

    expect(localStorage.getItem("app_version")).toBe("v1")
    expect(localStorage.getItem("session")).not.toBeNull()
    expect(localStorage.getItem("some-random-key")).not.toBeNull()
  })

  it("does nothing when version matches", async () => {
    setVersion("v2")
    localStorage.setItem("app_version", "v2")
    localStorage.setItem("some-stale-key", "should-stay")

    const handleVersionUpgrade = await importFresh()
    await handleVersionUpgrade()

    expect(localStorage.getItem("some-stale-key")).toBe("should-stay")
  })

  describe("version mismatch (upgrade)", () => {
    it("purges non-essential localStorage keys", async () => {
      setVersion("v2")
      localStorage.setItem("app_version", "v1")
      localStorage.setItem("hasProgramAtom", "true")
      localStorage.setItem("some-cache", "stale")

      const handleVersionUpgrade = await importFresh()
      await handleVersionUpgrade()

      expect(localStorage.getItem("app_version")).toBe("v2")
      expect(localStorage.getItem("hasProgramAtom")).toBeNull()
      expect(localStorage.getItem("some-cache")).toBeNull()
    })

    it("always preserves safe keys (locale, theme, auth token, etc.)", async () => {
      setVersion("v2")
      localStorage.setItem("app_version", "v1")
      localStorage.setItem("locale", "fr")
      localStorage.setItem("weightUnit", "lbs")
      localStorage.setItem("workout-app-theme", "dark")
      localStorage.setItem("installPrompt", '{"dismissed":true}')
      localStorage.setItem("notification_permission_granted", "true")
      localStorage.setItem("sb-abc123-auth-token", '{"access_token":"..."}')

      const handleVersionUpgrade = await importFresh()
      await handleVersionUpgrade()

      expect(localStorage.getItem("locale")).toBe("fr")
      expect(localStorage.getItem("weightUnit")).toBe("lbs")
      expect(localStorage.getItem("workout-app-theme")).toBe("dark")
      expect(localStorage.getItem("installPrompt")).not.toBeNull()
      expect(localStorage.getItem("notification_permission_granted")).toBe("true")
      expect(localStorage.getItem("sb-abc123-auth-token")).not.toBeNull()
    })

    it("always preserves offline queue and session meta (unsynced data)", async () => {
      setVersion("v2")
      localStorage.setItem("app_version", "v1")
      localStorage.setItem("offlineQueue:user-123", '[{"type":"set_log"}]')
      localStorage.setItem("sessionMeta:user-123", '{"sessionId":"abc"}')

      const handleVersionUpgrade = await importFresh()
      await handleVersionUpgrade()

      expect(localStorage.getItem("offlineQueue:user-123")).not.toBeNull()
      expect(localStorage.getItem("sessionMeta:user-123")).not.toBeNull()
    })

    it("purges session keys when no active workout", async () => {
      setVersion("v2")
      localStorage.setItem("app_version", "v1")
      localStorage.setItem("session", JSON.stringify({ isActive: false }))
      localStorage.setItem("rest", JSON.stringify({ startedAt: 0 }))
      localStorage.setItem("session-exercise-patch", "[]")
      localStorage.setItem("queueSyncMeta", '{"pendingCount":0}')
      localStorage.setItem("isQuickWorkout", "false")

      const handleVersionUpgrade = await importFresh()
      await handleVersionUpgrade()

      expect(localStorage.getItem("session")).toBeNull()
      expect(localStorage.getItem("rest")).toBeNull()
      expect(localStorage.getItem("session-exercise-patch")).toBeNull()
      expect(localStorage.getItem("queueSyncMeta")).toBeNull()
      expect(localStorage.getItem("isQuickWorkout")).toBeNull()
    })

    it("preserves session keys when user is mid-workout", async () => {
      setVersion("v2")
      localStorage.setItem("app_version", "v1")
      localStorage.setItem(
        "session",
        JSON.stringify({ isActive: true, currentDayId: "day-1", exerciseIndex: 2 }),
      )
      localStorage.setItem("rest", JSON.stringify({ startedAt: 1000, durationSeconds: 90 }))
      localStorage.setItem("session-exercise-patch", '[{"op":"swap"}]')
      localStorage.setItem("queueSyncMeta", '{"pendingCount":3}')
      localStorage.setItem("isQuickWorkout", "true")

      const handleVersionUpgrade = await importFresh()
      await handleVersionUpgrade()

      expect(localStorage.getItem("session")).not.toBeNull()
      expect(localStorage.getItem("rest")).not.toBeNull()
      expect(localStorage.getItem("session-exercise-patch")).not.toBeNull()
      expect(localStorage.getItem("queueSyncMeta")).not.toBeNull()
      expect(localStorage.getItem("isQuickWorkout")).toBe("true")
    })

    it("still purges non-essential keys even during active session", async () => {
      setVersion("v2")
      localStorage.setItem("app_version", "v1")
      localStorage.setItem("session", JSON.stringify({ isActive: true }))
      localStorage.setItem("stale-feature-flag", "old")

      const handleVersionUpgrade = await importFresh()
      await handleVersionUpgrade()

      expect(localStorage.getItem("stale-feature-flag")).toBeNull()
      expect(localStorage.getItem("session")).not.toBeNull()
    })

    it("handles corrupted session JSON gracefully (treats as no session)", async () => {
      setVersion("v2")
      localStorage.setItem("app_version", "v1")
      localStorage.setItem("session", "not-valid-json{{{")
      localStorage.setItem("rest", "some-rest-data")

      const handleVersionUpgrade = await importFresh()
      await handleVersionUpgrade()

      expect(localStorage.getItem("session")).toBeNull()
      expect(localStorage.getItem("rest")).toBeNull()
    })

    it("purges Workbox caches (supabase-api and precache)", async () => {
      setVersion("v2")
      localStorage.setItem("app_version", "v1")
      mockCacheStore.set("supabase-api", true)
      mockCacheStore.set("workbox-precache-v2-abc", true)
      mockCacheStore.set("some-other-cache", true)

      const handleVersionUpgrade = await importFresh()
      await handleVersionUpgrade()

      expect(mockCacheStore.has("supabase-api")).toBe(false)
      expect(mockCacheStore.has("workbox-precache-v2-abc")).toBe(false)
      expect(mockCacheStore.has("some-other-cache")).toBe(true)
    })
  })
})
