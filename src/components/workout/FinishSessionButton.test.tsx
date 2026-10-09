import { describe, it, expect } from "vitest"
import { screen, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Route, Routes } from "react-router-dom"
import { renderWithProviders } from "@/test/utils"
import {
  defaultSessionState,
  finishRequestAtom,
  sessionAtom,
} from "@/store/atoms"
import { FinishSessionButton } from "./FinishSessionButton"

function renderButton(initialEntry: string) {
  return renderWithProviders(
    <>
      <FinishSessionButton />
      <Routes>
        <Route path="/" element={<p>home route</p>} />
        <Route path="/history" element={<p>history route</p>} />
      </Routes>
    </>,
    { initialEntries: [initialEntry] },
  )
}

describe("FinishSessionButton", () => {
  it("is hidden when no session is active", () => {
    renderButton("/")

    expect(
      screen.queryByRole("button", { name: "Finish" }),
    ).not.toBeInTheDocument()
  })

  it("renders a finish control while a session is active", () => {
    const { store } = renderButton("/")

    act(() => {
      store.set(sessionAtom, {
        ...defaultSessionState,
        isActive: true,
        startedAt: Date.now(),
      })
    })

    expect(screen.getByRole("button", { name: "Finish" })).toBeInTheDocument()
  })

  it("renders as an icon-only control with no visible label", () => {
    const { store } = renderButton("/")

    act(() => {
      store.set(sessionAtom, {
        ...defaultSessionState,
        isActive: true,
        startedAt: Date.now(),
      })
    })

    const button = screen.getByRole("button", { name: "Finish" })
    expect(button.textContent).toBe("")
    expect(button.querySelector("svg")).not.toBeNull()
  })

  it("requests a finish on tap", async () => {
    const user = userEvent.setup()
    const { store } = renderButton("/")

    act(() => {
      store.set(sessionAtom, {
        ...defaultSessionState,
        isActive: true,
        startedAt: Date.now(),
      })
    })

    await user.click(screen.getByRole("button", { name: "Finish" }))

    expect(store.get(finishRequestAtom)).toBe(1)
  })

  it("navigates home before requesting the finish from another route", async () => {
    const user = userEvent.setup()
    const { store } = renderButton("/history")

    act(() => {
      store.set(sessionAtom, {
        ...defaultSessionState,
        isActive: true,
        startedAt: Date.now(),
      })
    })

    await user.click(screen.getByRole("button", { name: "Finish" }))

    expect(screen.getByText("home route")).toBeInTheDocument()
    expect(store.get(finishRequestAtom)).toBe(1)
  })
})
