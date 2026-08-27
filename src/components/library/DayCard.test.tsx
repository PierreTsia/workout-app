import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { DayCard, type DayCardItem, type DayExercise } from "./DayCard"

function asItems(exercises: DayExercise[]): DayCardItem[] {
  return exercises.map((ex) => ({ kind: "solo" as const, ...ex }))
}

const EXERCISES: DayExercise[] = [
  { id: "ex-1", emoji: "💪", name: "Bench Press", sets: 3, reps: "8-12", restSeconds: 90, sortOrder: 0 },
  { id: "ex-2", emoji: "🔥", name: "Squat", sets: 4, reps: "6-8", restSeconds: 120, sortOrder: 1 },
]

describe("DayCard", () => {
  it("renders day label", () => {
    renderWithProviders(
      <DayCard label="Day 1 — Push" exerciseCount={2} items={asItems(EXERCISES)} />,
    )
    expect(screen.getByText("Day 1 — Push")).toBeInTheDocument()
  })

  it("renders exercise count badge", () => {
    renderWithProviders(
      <DayCard label="Day 1" exerciseCount={2} items={asItems(EXERCISES)} />,
    )
    expect(screen.getByText("2 exercises")).toBeInTheDocument()
  })

  it("is a link to the Builder when to is set", () => {
    renderWithProviders(
      <DayCard
        label="Day 1 — Push"
        exerciseCount={2}
        items={asItems(EXERCISES)}
        to="/builder/p-1"
        linkState={{ dayId: "day-1", from: "/programs/p-1" }}
      />,
    )
    expect(screen.getByRole("link", { name: /Day 1 — Push/ })).toHaveAttribute(
      "href",
      "/builder/p-1",
    )
  })

  it("renders muscle focus when provided", () => {
    renderWithProviders(
      <DayCard
        label="Day 1"
        exerciseCount={2}
        muscleFocus="Chest"
        items={asItems(EXERCISES)}
      />,
    )
    expect(screen.getByText("Chest")).toBeInTheDocument()
  })

  it("does not render muscle focus when null", () => {
    renderWithProviders(
      <DayCard
        label="Day 1"
        exerciseCount={2}
        muscleFocus={null}
        items={asItems(EXERCISES)}
      />,
    )
    expect(screen.queryByText("Chest")).not.toBeInTheDocument()
  })

  it("renders exercise names with emojis", () => {
    renderWithProviders(
      <DayCard label="Day 1" exerciseCount={2} items={asItems(EXERCISES)} />,
    )
    expect(screen.getByText(/Bench Press/)).toBeInTheDocument()
    expect(screen.getByText(/Squat/)).toBeInTheDocument()
  })

  it("renders sets × reps and rest for each exercise", () => {
    renderWithProviders(
      <DayCard label="Day 1" exerciseCount={2} items={asItems(EXERCISES)} />,
    )
    expect(screen.getByText(/3 × 8-12/)).toBeInTheDocument()
    expect(screen.getByText(/90s rest/)).toBeInTheDocument()
    expect(screen.getByText(/4 × 6-8/)).toBeInTheDocument()
    expect(screen.getByText(/120s rest/)).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Instructions:/ }),
    ).not.toBeInTheDocument()
  })

  it("sorts exercises by sortOrder", () => {
    const reversed: DayExercise[] = [
      { id: "ex-2", emoji: "🔥", name: "Squat", sets: 4, reps: "6-8", restSeconds: 120, sortOrder: 1 },
      { id: "ex-1", emoji: "💪", name: "Bench Press", sets: 3, reps: "8-12", restSeconds: 90, sortOrder: 0 },
    ]
    renderWithProviders(
      <DayCard label="Day 1" exerciseCount={2} items={asItems(reversed)} />,
    )
    const items = screen.getAllByText(/Press|Squat/)
    expect(items[0].textContent).toContain("Bench Press")
    expect(items[1].textContent).toContain("Squat")
  })

  it("#454: renders Circuit summary lines and counts Circuit as one item", () => {
    renderWithProviders(
      <DayCard
        label="🔥 Jour A"
        exerciseCount={2}
        items={[
          {
            kind: "solo",
            id: "solo-1",
            emoji: "🔥",
            name: "Gainage planche",
            sets: 3,
            reps: "0",
            restSeconds: 30,
            sortOrder: 0,
          },
          {
            kind: "circuit",
            id: "block-1",
            label: "Finisher",
            rounds: 5,
            exerciseCount: 3,
            sortOrder: 1,
          },
        ]}
      />,
    )

    expect(screen.getByText("2 exercises")).toBeInTheDocument()
    expect(screen.getByTestId("day-card-circuit-block-1")).toBeInTheDocument()
    expect(screen.getByText("Finisher")).toBeInTheDocument()
    expect(screen.getByText(/3 exercises · 5 rounds/i)).toBeInTheDocument()
    expect(screen.getByText(/Gainage planche/)).toBeInTheDocument()
  })

  it("labels circuit station Rx as reps or seconds, not a naked count", () => {
    renderWithProviders(
      <DayCard
        label="Day 1"
        exerciseCount={1}
        items={[
          {
            kind: "circuit",
            id: "block-1",
            label: "Bear Bird Hollow",
            rounds: 3,
            exerciseCount: 2,
            sortOrder: 0,
            stations: [
              {
                id: "s-1",
                name: "Bear walk",
                emoji: "🔥",
                amounts: [10],
                isDuration: false,
              },
              {
                id: "s-2",
                name: "Hollow hold",
                emoji: "🔥",
                amounts: [30],
                isDuration: true,
              },
            ],
          },
        ]}
      />,
    )

    expect(screen.getByText("10 reps")).toBeInTheDocument()
    expect(screen.getByText("30s")).toBeInTheDocument()
  })
})
