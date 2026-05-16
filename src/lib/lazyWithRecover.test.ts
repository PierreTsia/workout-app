import { describe, it, expect, vi, beforeEach } from "vitest"
import type { ComponentType } from "react"
import {
  createRecoveringLoader,
  isChunkLoadFailure,
} from "./lazyWithRecover"

const RELOAD_KEY = "chunk-load-reload-attempted-at"

type FakeModule = { default: ComponentType<unknown> }
const FakePage = (() => null) as ComponentType<unknown>

function chunkError(): TypeError {
  return new TypeError(
    "Failed to fetch dynamically imported module: https://example.com/assets/X.js",
  )
}

describe("isChunkLoadFailure", () => {
  it("matches the Vite/Rollup chunk-fetch error", () => {
    expect(isChunkLoadFailure(chunkError())).toBe(true)
  })

  it("matches the Safari variant", () => {
    expect(
      isChunkLoadFailure(new Error("Importing a module script failed.")),
    ).toBe(true)
  })

  it("matches the Firefox variant", () => {
    expect(
      isChunkLoadFailure(new Error("error loading dynamically imported module")),
    ).toBe(true)
  })

  it("returns false for unrelated errors and non-Error values", () => {
    expect(isChunkLoadFailure(new Error("Boom"))).toBe(false)
    expect(isChunkLoadFailure("string")).toBe(false)
    expect(isChunkLoadFailure(undefined)).toBe(false)
    expect(isChunkLoadFailure(null)).toBe(false)
  })
})

describe("createRecoveringLoader", () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it("returns the loaded module on the happy path", async () => {
    const reload = vi.fn()
    const loaded: FakeModule = { default: FakePage }
    const recover = createRecoveringLoader(() => Promise.resolve(loaded), {
      reload,
    })

    await expect(recover()).resolves.toBe(loaded)
    expect(reload).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(RELOAD_KEY)).toBeNull()
  })

  it("triggers exactly one reload on chunk-load failure and parks the promise", async () => {
    const reload = vi.fn()
    const loader = vi.fn(() => Promise.reject(chunkError()))
    const recover = createRecoveringLoader(loader as () => Promise<FakeModule>, {
      reload,
      now: () => 1_000,
    })

    let resolved = false
    void recover().then(() => {
      resolved = true
    })
    // Flush the microtask queue so the loader's rejection is observed
    // and the recovery branch runs.
    await Promise.resolve()
    await Promise.resolve()

    expect(loader).toHaveBeenCalledTimes(1)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(RELOAD_KEY)).toBe("1000")
    expect(resolved).toBe(false)
  })

  it("does NOT reload when the guard is still fresh", async () => {
    sessionStorage.setItem(RELOAD_KEY, "1000")
    const reload = vi.fn()
    const recover = createRecoveringLoader(
      () => Promise.reject(chunkError()) as Promise<FakeModule>,
      { reload, now: () => 30_000 },
    )

    await expect(recover()).rejects.toThrow(
      /Failed to fetch dynamically imported module/,
    )
    expect(reload).not.toHaveBeenCalled()
  })

  it("reloads again once the guard window expires", async () => {
    sessionStorage.setItem(RELOAD_KEY, "1000")
    const reload = vi.fn()
    const recover = createRecoveringLoader(
      () => Promise.reject(chunkError()) as Promise<FakeModule>,
      { reload, now: () => 70_000 },
    )

    void recover()
    await Promise.resolve()
    await Promise.resolve()

    expect(reload).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(RELOAD_KEY)).toBe("70000")
  })

  it("propagates non-chunk-load errors instead of reloading", async () => {
    const reload = vi.fn()
    const recover = createRecoveringLoader(
      () => Promise.reject(new Error("Some other failure")) as Promise<FakeModule>,
      { reload },
    )

    await expect(recover()).rejects.toThrow("Some other failure")
    expect(reload).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(RELOAD_KEY)).toBeNull()
  })

  it("ignores a corrupted guard value", async () => {
    sessionStorage.setItem(RELOAD_KEY, "not-a-number")
    const reload = vi.fn()
    const recover = createRecoveringLoader(
      () => Promise.reject(chunkError()) as Promise<FakeModule>,
      { reload, now: () => 5_000 },
    )

    void recover()
    await Promise.resolve()
    await Promise.resolve()

    expect(reload).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(RELOAD_KEY)).toBe("5000")
  })
})
