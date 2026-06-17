import "@testing-library/jest-dom/vitest"

// vitest 4's jsdom environment no longer exposes jsdom's localStorage (the
// document origin is opaque), so we provide a minimal in-memory Storage. Keys
// are stored as own enumerable properties (methods live on the prototype, so
// they're non-enumerable) so `Object.keys(localStorage)` behaves like the real
// thing. Drop this once the env exposes a real Storage again.
if (typeof globalThis.localStorage === "undefined") {
  class MemoryStorage {
    get length(): number {
      return Object.keys(this).length
    }
    clear(): void {
      Object.keys(this).forEach((key) => {
        delete (this as Record<string, unknown>)[key]
      })
    }
    getItem(key: string): string | null {
      return Object.prototype.hasOwnProperty.call(this, key)
        ? (this as Record<string, string>)[key]
        : null
    }
    key(index: number): string | null {
      return Object.keys(this)[index] ?? null
    }
    removeItem(key: string): void {
      delete (this as Record<string, unknown>)[key]
    }
    setItem(key: string, value: string): void {
      ;(this as Record<string, string>)[key] = String(value)
    }
  }
  const memory = new MemoryStorage() as unknown as Storage
  globalThis.localStorage = memory
  if (typeof globalThis.window !== "undefined") {
    globalThis.window.localStorage = memory
  }
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

Element.prototype.scrollIntoView ??= () => {}

beforeEach(() => {
  localStorage.clear()
})
