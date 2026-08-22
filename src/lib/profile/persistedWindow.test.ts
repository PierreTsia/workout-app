import { afterEach, describe, expect, it } from "vitest"
import {
  DEFAULT_PROFILE_WINDOW,
  PROFILE_WINDOW_STORAGE_KEY,
  readPersistedProfileWindow,
  resolveProfileWindow,
  writePersistedProfileWindow,
} from "./persistedWindow"

function throwingStorage(method: "getItem" | "setItem"): Storage {
  return {
    getItem: () => {
      if (method === "getItem") throw new Error("SecurityError")
      return null
    },
    setItem: () => {
      if (method === "setItem") throw new Error("SecurityError")
    },
    removeItem: () => undefined,
    clear: () => undefined,
    key: () => null,
    length: 0,
  }
}

afterEach(() => {
  localStorage.clear()
})

describe("readPersistedProfileWindow", () => {
  it("returns a stored cran", () => {
    localStorage.setItem(PROFILE_WINDOW_STORAGE_KEY, "100")
    expect(readPersistedProfileWindow(localStorage)).toBe("100")
  })

  it("returns null when the key is missing", () => {
    expect(readPersistedProfileWindow(localStorage)).toBeNull()
  })

  it("returns null for junk, JSON-wrapped, or unknown crans", () => {
    localStorage.setItem(PROFILE_WINDOW_STORAGE_KEY, "week")
    expect(readPersistedProfileWindow(localStorage)).toBeNull()
    localStorage.setItem(PROFILE_WINDOW_STORAGE_KEY, '"30"')
    expect(readPersistedProfileWindow(localStorage)).toBeNull()
    localStorage.setItem(PROFILE_WINDOW_STORAGE_KEY, "90")
    expect(readPersistedProfileWindow(localStorage)).toBeNull()
  })

  it("returns null when localStorage throws", () => {
    expect(readPersistedProfileWindow(throwingStorage("getItem"))).toBeNull()
  })
})

describe("writePersistedProfileWindow", () => {
  it("writes the bare cran", () => {
    writePersistedProfileWindow(localStorage, "365")
    expect(localStorage.getItem(PROFILE_WINDOW_STORAGE_KEY)).toBe("365")
  })

  it("does not throw when localStorage throws", () => {
    expect(() =>
      writePersistedProfileWindow(throwingStorage("setItem"), "7"),
    ).not.toThrow()
  })
})

describe("resolveProfileWindow", () => {
  it("falls back to the month cran", () => {
    expect(resolveProfileWindow(localStorage)).toBe(DEFAULT_PROFILE_WINDOW)
    expect(DEFAULT_PROFILE_WINDOW).toBe("30")
  })

  it("prefers a valid stored cran", () => {
    localStorage.setItem(PROFILE_WINDOW_STORAGE_KEY, "100")
    expect(resolveProfileWindow(localStorage)).toBe("100")
  })

  it("migrates a stored Toujours cran off the broken view", () => {
    localStorage.setItem(PROFILE_WINDOW_STORAGE_KEY, "all")
    expect(resolveProfileWindow(localStorage)).toBe(DEFAULT_PROFILE_WINDOW)
    expect(localStorage.getItem(PROFILE_WINDOW_STORAGE_KEY)).toBe(
      DEFAULT_PROFILE_WINDOW,
    )
  })
})
