import "@testing-library/jest-dom/vitest"

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
