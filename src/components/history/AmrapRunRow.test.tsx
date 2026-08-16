import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import type { AmrapRunView } from "@/lib/amrapScore"
import { AmrapRunRow } from "./AmrapRunRow"

function makeView(overrides: Partial<AmrapRunView> = {}): AmrapRunView {
  return {
    sessionId: "s2",
    date: "2026-08-15T10:00:00.000Z",
    fingerprint: "amrap|1200|ex-1:5:0",
    isComplete: true,
    score: { fullRounds: 27, leftover: 3, leftoverName: "push-ups" },
    deltaRounds: 2,
    isPb: true,
    shapeChanged: false,
    ...overrides,
  }
}

describe("AmrapRunRow", () => {
  it("renders the AMRAP score, PB chip, and rounds delta", () => {
    renderWithProviders(
      <ul>
        <AmrapRunRow view={makeView()} />
      </ul>,
    )

    expect(screen.getByText("27+3")).toBeInTheDocument()
    expect(screen.getByText("27 rounds · 3 push-ups")).toBeInTheDocument()
    expect(screen.getByText("PB")).toBeInTheDocument()
    expect(screen.getByText(/2 rounds/)).toBeInTheDocument()
    expect(screen.getByText(/vs last/)).toBeInTheDocument()
  })
})
