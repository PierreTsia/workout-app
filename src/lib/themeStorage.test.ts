import { afterEach, describe, expect, it, beforeEach, vi } from "vitest"
import {
  LEGACY_THEME_STORAGE_KEY,
  normalizeLegacyThemeLocalStorage,
  parseStoredThemePreference,
  prepareThemeLocalStorage,
  resolveThemeClassForBoot,
  THEME_FALLBACK_RESOLVED,
  THEME_STORAGE_KEY,
} from "./themeStorage"

function mockStorage(): Storage {
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v)
    },
    removeItem: (k) => {
      map.delete(k)
    },
    clear: () => map.clear(),
    key: () => null,
    get length() {
      return map.size
    },
  }
}

describe("parseStoredThemePreference", () => {
  it("returns null for empty", () => {
    expect(parseStoredThemePreference(null)).toBeNull()
    expect(parseStoredThemePreference("")).toBeNull()
    expect(parseStoredThemePreference("   ")).toBeNull()
  })

  it("parses plain light, dark, system", () => {
    expect(parseStoredThemePreference("light")).toBe("light")
    expect(parseStoredThemePreference("dark")).toBe("dark")
    expect(parseStoredThemePreference("system")).toBe("system")
  })

  it("parses JSON-encoded values", () => {
    expect(parseStoredThemePreference(JSON.stringify("light"))).toBe("light")
    expect(parseStoredThemePreference(JSON.stringify("system"))).toBe("system")
  })
})

describe("resolveThemeClassForBoot", () => {
  afterEach(() => {
    delete (window as unknown as { matchMedia?: typeof window.matchMedia })
      .matchMedia
  })

  function mockOsPrefersDark(osPrefersDark: boolean) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches:
        query.includes("prefers-color-scheme: dark") && osPrefersDark,
      media: query,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  }

  it("returns light or dark when explicitly stored", () => {
    const s = mockStorage()
    s.setItem(THEME_STORAGE_KEY, "light")
    expect(resolveThemeClassForBoot(s)).toBe("light")
    s.setItem(THEME_STORAGE_KEY, "dark")
    expect(resolveThemeClassForBoot(s)).toBe("dark")
  })

  it("when stored system matches dark OS", () => {
    mockOsPrefersDark(true)
    const s = mockStorage()
    s.setItem(THEME_STORAGE_KEY, "system")
    expect(resolveThemeClassForBoot(s)).toBe("dark")
  })

  it("when stored system matches light OS", () => {
    mockOsPrefersDark(false)
    const s = mockStorage()
    s.setItem(THEME_STORAGE_KEY, "system")
    expect(resolveThemeClassForBoot(s)).toBe("light")
  })

  it("when nothing stored, uses OS (light)", () => {
    mockOsPrefersDark(false)
    expect(resolveThemeClassForBoot(mockStorage())).toBe("light")
  })

  it("when nothing stored, uses OS (dark)", () => {
    mockOsPrefersDark(true)
    expect(resolveThemeClassForBoot(mockStorage())).toBe("dark")
  })

  it("when matchMedia throws, uses THEME_FALLBACK_RESOLVED", () => {
    window.matchMedia = vi.fn(() => {
      throw new Error("no media")
    })
    expect(resolveThemeClassForBoot(mockStorage())).toBe(THEME_FALLBACK_RESOLVED)
  })
})

describe("normalizeLegacyThemeLocalStorage", () => {
  let storage: Storage

  beforeEach(() => {
    storage = mockStorage()
  })

  it("leaves plain dark unchanged", () => {
    storage.setItem(THEME_STORAGE_KEY, "dark")
    normalizeLegacyThemeLocalStorage(storage, THEME_STORAGE_KEY)
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe("dark")
  })

  it("leaves plain light unchanged", () => {
    storage.setItem(THEME_STORAGE_KEY, "light")
    normalizeLegacyThemeLocalStorage(storage, THEME_STORAGE_KEY)
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe("light")
  })

  it("leaves system unchanged", () => {
    storage.setItem(THEME_STORAGE_KEY, "system")
    normalizeLegacyThemeLocalStorage(storage, THEME_STORAGE_KEY)
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe("system")
  })

  it("converts JSON-encoded dark from Jotai-style storage", () => {
    storage.setItem(THEME_STORAGE_KEY, JSON.stringify("dark"))
    normalizeLegacyThemeLocalStorage(storage, THEME_STORAGE_KEY)
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe("dark")
  })

  it("converts JSON-encoded light", () => {
    storage.setItem(THEME_STORAGE_KEY, JSON.stringify("light"))
    normalizeLegacyThemeLocalStorage(storage, THEME_STORAGE_KEY)
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe("light")
  })

  it("trims whitespace around plain values", () => {
    storage.setItem(THEME_STORAGE_KEY, "  light  ")
    normalizeLegacyThemeLocalStorage(storage, THEME_STORAGE_KEY)
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe("light")
  })

  it("removes invalid values", () => {
    storage.setItem(THEME_STORAGE_KEY, "not-a-theme")
    normalizeLegacyThemeLocalStorage(storage, THEME_STORAGE_KEY)
    expect(storage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })

  it("no-ops when key is absent", () => {
    normalizeLegacyThemeLocalStorage(storage, THEME_STORAGE_KEY)
    expect(storage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })
})

describe("prepareThemeLocalStorage", () => {
  let storage: Storage

  beforeEach(() => {
    storage = mockStorage()
  })

  it("migrates plain light from legacy key when canonical key is empty", () => {
    storage.setItem(LEGACY_THEME_STORAGE_KEY, "light")
    prepareThemeLocalStorage(storage)
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe("light")
    expect(storage.getItem(LEGACY_THEME_STORAGE_KEY)).toBeNull()
  })

  it("migrates JSON-encoded dark from legacy key", () => {
    storage.setItem(LEGACY_THEME_STORAGE_KEY, JSON.stringify("dark"))
    prepareThemeLocalStorage(storage)
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe("dark")
    expect(storage.getItem(LEGACY_THEME_STORAGE_KEY)).toBeNull()
  })

  it("does not overwrite canonical key when already set but drops stale legacy", () => {
    storage.setItem(THEME_STORAGE_KEY, "light")
    storage.setItem(LEGACY_THEME_STORAGE_KEY, "dark")
    prepareThemeLocalStorage(storage)
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe("light")
    expect(storage.getItem(LEGACY_THEME_STORAGE_KEY)).toBeNull()
  })

  it("normalizes JSON on canonical key without legacy", () => {
    storage.setItem(THEME_STORAGE_KEY, JSON.stringify("light"))
    prepareThemeLocalStorage(storage)
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe("light")
  })
})
