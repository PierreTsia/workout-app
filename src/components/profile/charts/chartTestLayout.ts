const CHART_WIDTH = 400
const CHART_HEIGHT = 220

const sizedRect = (): DOMRect => ({
  width: CHART_WIDTH,
  height: CHART_HEIGHT,
  top: 0,
  left: 0,
  bottom: CHART_HEIGHT,
  right: CHART_WIDTH,
  x: 0,
  y: 0,
  toJSON: () => ({}),
})

const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect
const OriginalResizeObserver = globalThis.ResizeObserver

class ImmediateResizeObserver implements ResizeObserver {
  readonly #callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.#callback = callback
  }

  observe(target: Element): void {
    const rect = target.getBoundingClientRect()
    this.#callback(
      [
        {
          target,
          contentRect: rect,
          borderBoxSize: [],
          contentBoxSize: [],
          devicePixelContentBoxSize: [],
        },
      ],
      this,
    )
  }

  unobserve(): void {}
  disconnect(): void {}
}

/**
 * jsdom reports 0×0 boxes, and Recharts 3's ResponsiveContainer then refuses
 * to paint. Give ChartContainer a real size so axis ticks exist in tests.
 */
export function stubChartLayout(): void {
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    if (
      this.classList.contains("recharts-responsive-container") ||
      this.hasAttribute("data-chart")
    ) {
      return sizedRect()
    }
    return originalGetBoundingClientRect.call(this)
  }
  globalThis.ResizeObserver = ImmediateResizeObserver
}

export function restoreChartLayout(): void {
  Element.prototype.getBoundingClientRect = originalGetBoundingClientRect
  globalThis.ResizeObserver = OriginalResizeObserver
}
