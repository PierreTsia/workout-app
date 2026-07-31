import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import type { SavedWorkout } from "@/hooks/useSavedWorkouts"

const mockUseSavedWorkouts = vi.fn<() => { data: SavedWorkout[] }>()

vi.mock("@/hooks/useSavedWorkouts", () => ({
  useSavedWorkouts: () => mockUseSavedWorkouts(),
}))
vi.mock("@/hooks/useDeleteSavedWorkout", () => ({
  useDeleteSavedWorkout: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock("@/hooks/useStartSavedWorkout", () => ({
  useStartSavedWorkout: () => ({ mutate: vi.fn(), isPending: false }),
}))

import { SavedWorkoutsSection } from "./SavedWorkoutsSection"

type SavedRow = SavedWorkout["workout_exercises"][number]

const row = (overrides: Partial<SavedRow> & { id: string }): SavedRow => ({
  name_snapshot: "Développé couché",
  emoji_snapshot: "🏋️",
  sets: 3,
  reps: "8",
  muscle_snapshot: "Pectoraux",
  exercise: null,
  ...overrides,
})

const workout = (rows: SavedRow[]): SavedWorkout =>
  ({
    id: "day-1",
    label: "Push draft",
    saved_at: "2026-01-01T10:00:00Z",
    workout_exercises: rows,
  }) as SavedWorkout

function render(rows: SavedRow[], locale: "en" | "fr" = "en") {
  mockUseSavedWorkouts.mockReturnValue({ data: [workout(rows)] })
  return renderWithProviders(<SavedWorkoutsSection />, { locale })
}

const catalogRow = (muscleGroup: string) => ({
  id: "bench",
  name: "Développé couché",
  name_en: "Bench Press",
  muscle_group: muscleGroup,
  equipment: "barbell",
  emoji: "🏋️",
})

describe("SavedWorkoutsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([
    ["en", "Chest"],
    ["fr", "Pectoraux"],
  ] as const)("labels the muscle badge in %s", (locale, label) => {
    render([row({ id: "we-1", exercise: catalogRow("Pectoraux") })], locale)

    expect(screen.getByText(label)).toBeInTheDocument()
  })

  // Two rows, one muscle: deduplicating on the frozen spelling would print the
  // same badge twice as soon as the snapshots disagree.
  it("collapses rows whose snapshots disagree but whose catalog muscle matches", () => {
    render([
      row({
        id: "we-1",
        muscle_snapshot: "Chest",
        exercise: catalogRow("Pectoraux"),
      }),
      row({
        id: "we-2",
        muscle_snapshot: "Pectoraux",
        exercise: catalogRow("Pectoraux"),
      }),
    ])

    expect(screen.getAllByText("Chest")).toHaveLength(1)
  })

  // Without an embed there is nothing canonical to collapse on, and a legacy
  // English snapshot renders identically to the French one it duplicates.
  it("collapses rows with no embed whose snapshots render the same label", () => {
    render([
      row({ id: "we-1", muscle_snapshot: "Chest" }),
      row({ id: "we-2", muscle_snapshot: "Pectoraux" }),
    ])

    expect(screen.getAllByText("Chest")).toHaveLength(1)
  })

  it("falls back to the snapshot when the catalog row is missing", () => {
    render([row({ id: "we-1", muscle_snapshot: "Deltoïdes post." })])

    expect(screen.getByText("Deltoïdes post.")).toBeInTheDocument()
  })
})
