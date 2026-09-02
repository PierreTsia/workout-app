import { describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders, mockQueryResult } from "@/test/utils"
import type { WorkoutDayWithExerciseCount } from "@/hooks/useWorkoutDays"
import type { ProgramIntentDay } from "@/lib/programScore/types"
import type { ProgramIntentScore } from "@/lib/programScore/hypertrophyExample"

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}))

vi.mock("react-body-highlighter", () => ({
  default: ({
    type,
    style,
  }: {
    type: string
    style?: { maxWidth?: string }
  }) => (
    <div
      data-testid={`body-model-${type}`}
      data-max-width={style?.maxWidth}
    />
  ),
  MuscleType: {},
  ModelType: { ANTERIOR: "anterior", POSTERIOR: "posterior" },
}))

const useWorkoutDays = vi.hoisted(() => vi.fn())
vi.mock("@/hooks/useWorkoutDays", () => ({ useWorkoutDays }))

const useProgramIntent = vi.hoisted(() => vi.fn())
vi.mock("@/hooks/useProgramIntent", () => ({ useProgramIntent }))

const idleMutation = vi.hoisted(() => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
}))

vi.mock("@/hooks/useBuilderMutations", () => ({
  useCreateDay: () => idleMutation,
  useDeleteDay: () => idleMutation,
  useReorderDays: () => idleMutation,
}))

import { DayList } from "./DayList"

function makeDay(): WorkoutDayWithExerciseCount {
  return {
    id: "day-1",
    user_id: "user-1",
    program_id: "prog-1",
    label: "Push A",
    emoji: "🔥",
    sort_order: 0,
    created_at: "1970-01-01T00:00:00Z",
    saved_at: null,
    exerciseCount: 3,
  }
}

function makeIntentDay(): ProgramIntentDay {
  return {
    id: "day-1",
    label: "Push A",
    sortOrder: 0,
    solos: [
      {
        sets: 4,
        restSeconds: 90,
        repMax: 10,
        measurementType: "reps",
        primaryMuscle: "Pectoraux",
        secondaryMuscles: ["Triceps"],
        equipment: "barbell",
      },
    ],
    circuits: [],
  }
}

function emptyScore(): ProgramIntentScore {
  return {
    hypertrophy: { band: "empty", volume: "empty", frequency: "empty" },
    strength: { band: "empty" },
    endurance: { band: "empty" },
    balance: { kind: "empty" },
    facts: {
      dayCount: 1,
      setCount: 0,
      circuitCount: 0,
      circuitModes: { amrap: 0, rounds: 0 },
      mix: { free: 0, machine: 0, bodyweight: 0, other: 0 },
    },
  }
}

describe("DayList intent minis", () => {
  it("shows a sm Body Map for a day with a slot and drops the exerciseCount subtitle", () => {
    useWorkoutDays.mockReturnValue(mockQueryResult([makeDay()]))
    useProgramIntent.mockReturnValue(
      mockQueryResult({
        ...emptyScore(),
        days: [makeIntentDay()],
      }),
    )

    renderWithProviders(
      <DayList
        programId="prog-1"
        onSelectDay={vi.fn()}
        onMutationStateChange={vi.fn()}
      />,
    )

    const anterior = screen.getByTestId("body-model-anterior")
    expect(anterior).toBeInTheDocument()
    expect(anterior).toHaveAttribute("data-max-width", "64px")
    expect(screen.queryByText("3 exercises")).not.toBeInTheDocument()
    expect(screen.queryByText("1 exercise")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /new day/i })).toBeInTheDocument()
  })
})
