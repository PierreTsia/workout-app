import { beforeEach, describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"
import { Route, Routes } from "react-router-dom"
import { renderWithProviders } from "@/test/utils"
import { AppShell } from "./AppShell"

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }))

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "dark", setTheme: vi.fn() }),
}))

function renderShell() {
  return renderWithProviders(
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<p>page body</p>} />
      </Route>
    </Routes>,
  )
}

describe("AppShell", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  })

  it("scrolls on a full-bleed layer, not the max-w-5xl content column", () => {
    renderShell()

    const main = screen.getByRole("main")
    expect(main).toHaveClass("overflow-y-auto")
    expect(main).not.toHaveClass("max-w-5xl")

    const column = main.querySelector(".max-w-5xl")
    expect(column).toBeTruthy()
    if (!column) return
    expect(column).not.toHaveClass("overflow-y-auto")
  })

  it("styles the shell scrollbar thin and on-theme, not OS default grey", () => {
    renderShell()

    expect(screen.getByRole("main")).toHaveClass("scrollbar-thin")
  })
})
