import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { DayCard } from "./DayCard"
import type { DayExercise } from "./DayCard"

const EXERCISES: DayExercise[] = [
  { id: "ex-1", emoji: "💪", name: "Bench Press", sets: 3, reps: "8-12", restSeconds: 90, sortOrder: 0 },
  { id: "ex-2", emoji: "🔥", name: "Squat", sets: 4, reps: "6-8", restSeconds: 120, sortOrder: 1 },
]

describe("DayCard", () => {
  it("renders day label", () => {
    renderWithProviders(<DayCard label="Day 1 — Push" exerciseCount={2} exercises={EXERCISES} />)
    expect(screen.getByText("Day 1 — Push")).toBeInTheDocument()
  })

  it("renders exercise count badge", () => {
    renderWithProviders(<DayCard label="Day 1" exerciseCount={2} exercises={EXERCISES} />)
    expect(screen.getByText("2 exercises")).toBeInTheDocument()
  })

  it("renders muscle focus when provided", () => {
    renderWithProviders(<DayCard label="Day 1" exerciseCount={2} muscleFocus="Chest" exercises={EXERCISES} />)
    expect(screen.getByText("Chest")).toBeInTheDocument()
  })

  it("does not render muscle focus when null", () => {
    renderWithProviders(<DayCard label="Day 1" exerciseCount={2} muscleFocus={null} exercises={EXERCISES} />)
    expect(screen.queryByText("Chest")).not.toBeInTheDocument()
  })

  it("renders exercise names with emojis", () => {
    renderWithProviders(<DayCard label="Day 1" exerciseCount={2} exercises={EXERCISES} />)
    expect(screen.getByText(/Bench Press/)).toBeInTheDocument()
    expect(screen.getByText(/Squat/)).toBeInTheDocument()
  })

  it("renders sets × reps and rest for each exercise", () => {
    renderWithProviders(<DayCard label="Day 1" exerciseCount={2} exercises={EXERCISES} />)
    expect(screen.getByText(/3 × 8-12/)).toBeInTheDocument()
    expect(screen.getByText(/90s rest/)).toBeInTheDocument()
    expect(screen.getByText(/4 × 6-8/)).toBeInTheDocument()
    expect(screen.getByText(/120s rest/)).toBeInTheDocument()
  })

  it("sorts exercises by sortOrder", () => {
    const reversed: DayExercise[] = [
      { id: "ex-2", emoji: "🔥", name: "Squat", sets: 4, reps: "6-8", restSeconds: 120, sortOrder: 1 },
      { id: "ex-1", emoji: "💪", name: "Bench Press", sets: 3, reps: "8-12", restSeconds: 90, sortOrder: 0 },
    ]
    renderWithProviders(<DayCard label="Day 1" exerciseCount={2} exercises={reversed} />)
    const items = screen.getAllByText(/Press|Squat/)
    expect(items[0].textContent).toContain("Bench Press")
    expect(items[1].textContent).toContain("Squat")
  })
})
