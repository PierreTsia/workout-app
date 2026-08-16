import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { CircuitRxList } from "./CircuitRxList"

const PULL_ID = "11111111-1111-4111-8111-111111111111"
const PUSH_ID = "22222222-2222-4222-8222-222222222222"
const SQUAT_ID = "33333333-3333-4333-8333-333333333333"

const byId = new Map([
  [PULL_ID, { name: "Tractions", name_en: "Pull-ups" }],
  [PUSH_ID, { name: "Pompes", name_en: "Push-ups" }],
  [SQUAT_ID, { name: "Squats", name_en: "Air squats" }],
])

describe("CircuitRxList", () => {
  it("lists each station as catalog amount times the localized name", () => {
    renderWithProviders(
      <CircuitRxList
        exercises={[
          { exercise_id: PULL_ID, amount: 5 },
          { exercise_id: PUSH_ID, amount: 10 },
          { exercise_id: SQUAT_ID, amount: 15 },
        ]}
        byId={byId}
      />,
      { locale: "en" },
    )

    const items = screen.getAllByRole("listitem")
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent("5")
    expect(items[0]).toHaveTextContent("Pull-ups")
    expect(items[1]).toHaveTextContent("10")
    expect(items[1]).toHaveTextContent("Push-ups")
    expect(items[2]).toHaveTextContent("15")
    expect(items[2]).toHaveTextContent("Air squats")
    expect(screen.queryByText(PULL_ID)).not.toBeInTheDocument()
  })

  it("shows a muted fallback when a station id is missing from the catalog map", () => {
    renderWithProviders(
      <CircuitRxList
        exercises={[{ exercise_id: PULL_ID, amount: 7 }]}
        byId={new Map()}
      />,
    )

    expect(screen.getByRole("listitem")).toHaveTextContent("7")
    expect(screen.getByText("Unknown exercise")).toBeInTheDocument()
    expect(screen.queryByText(PULL_ID)).not.toBeInTheDocument()
  })
})
