import { afterEach, describe, expect, it, vi } from "vitest"
import { act, screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { BlockGoCountdown } from "@/components/workout/BlockGoCountdown"

describe("BlockGoCountdown", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("shows 3 at the start of the countdown", () => {
    vi.useFakeTimers()
    renderWithProviders(<BlockGoCountdown onComplete={vi.fn()} />)

    expect(
      screen.getByRole("region", { name: /get ready/i }),
    ).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
  })

  it("counts 3-2-1-GO then calls onComplete", () => {
    vi.useFakeTimers()
    const onComplete = vi.fn()
    renderWithProviders(<BlockGoCountdown onComplete={onComplete} />)

    expect(screen.getByText("3")).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1_000)
    })
    expect(screen.getByText("2")).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1_000)
    })
    expect(screen.getByText("1")).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1_000)
    })
    expect(screen.getByText("GO")).toBeInTheDocument()
    expect(onComplete).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1_000)
    })
    expect(onComplete).toHaveBeenCalledOnce()
  })
})
