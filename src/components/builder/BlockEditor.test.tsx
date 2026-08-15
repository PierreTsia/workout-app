import { vi, describe, it, expect, beforeEach } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { BlockEditor } from "@/components/builder/BlockEditor"
import type { ExerciseBlockWithExercises } from "@/types/database"

const updates: { table: string; payload: unknown }[] = []

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => ({
      update: (payload: unknown) => ({
        eq: () => {
          updates.push({ table, payload })
          return Promise.resolve({ error: null })
        },
      }),
    }),
  },
}))

vi.mock("@/hooks/useMediaQuery", () => ({
  useMediaQuery: () => true,
}))

function makeBlock(
  overrides: Partial<ExerciseBlockWithExercises> = {},
): ExerciseBlockWithExercises {
  return {
    id: "b-cindy",
    workout_day_id: "day-1",
    label: "Cindy",
    rounds: 1,
    rest_seconds: 0,
    transition_seconds: 0,
    mode: "amrap",
    cap_seconds: 1200,
    sort_order: 0,
    created_at: "1970-01-01T00:00:00Z",
    exercises: [
      {
        id: "be-pull",
        block_id: "b-cindy",
        exercise_id: "ex-pull",
        name_snapshot: "Pull-up",
        muscle_snapshot: "back",
        emoji_snapshot: "💪",
        position: 0,
        per_round: [{ amount: 5, weight: 0 }],
        exercise: null,
      },
      {
        id: "be-push",
        block_id: "b-cindy",
        exercise_id: "ex-push",
        name_snapshot: "Push-up",
        muscle_snapshot: "chest",
        emoji_snapshot: "🔥",
        position: 1,
        per_round: [{ amount: 10, weight: 0 }],
        exercise: null,
      },
      {
        id: "be-squat",
        block_id: "b-cindy",
        exercise_id: "ex-squat",
        name_snapshot: "Squat",
        muscle_snapshot: "legs",
        emoji_snapshot: "🦵",
        position: 2,
        per_round: [{ amount: 15, weight: 0 }],
        exercise: null,
      },
    ],
    ...overrides,
  }
}

describe("BlockEditor", () => {
  beforeEach(() => {
    updates.length = 0
  })

  it("reopens an AMRAP block on the AMRAP toggle with a 20 min cap and no rest fields", () => {
    renderWithProviders(
      <BlockEditor
        open
        onOpenChange={vi.fn()}
        block={makeBlock()}
        dayId="day-1"
        onMutationStateChange={vi.fn()}
      />,
    )

    const amrap = screen.getByRole("radio", { name: /AMRAP 20 min/i })
    expect(amrap).toHaveAttribute("data-state", "on")
    expect(screen.getByLabelText(/minutes/i)).toHaveValue(20)
    expect(screen.queryByLabelText(/rest \(sec\)/i)).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText(/transition \(sec\)/i),
    ).not.toBeInTheDocument()
  })

  it("keeps a flat Tours block on a uniform list until the per-round grid is opted in", async () => {
    const user = userEvent.setup()
    const tours = makeBlock({
      mode: "rounds",
      cap_seconds: null,
      rounds: 4,
      rest_seconds: 90,
      exercises: makeBlock().exercises.map((ex) => ({
        ...ex,
        per_round: Array.from({ length: 4 }, () => ({
          amount: ex.per_round[0].amount,
          weight: 0,
        })),
      })),
    })

    renderWithProviders(
      <BlockEditor
        open
        onOpenChange={vi.fn()}
        block={tours}
        dayId="day-1"
        onMutationStateChange={vi.fn()}
      />,
    )

    expect(screen.queryByText("R2")).not.toBeInTheDocument()
    await user.click(
      screen.getByRole("button", { name: /customize per round/i }),
    )
    expect(screen.getAllByText("R2").length).toBeGreaterThan(0)
  })

  it("persists Cindy as AMRAP 20 min when switching from Tours", async () => {
    const user = userEvent.setup()
    const tours = makeBlock({
      mode: "rounds",
      cap_seconds: null,
      rounds: 3,
      rest_seconds: 90,
      transition_seconds: 20,
      exercises: makeBlock().exercises.map((ex) => ({
        ...ex,
        per_round: Array.from({ length: 3 }, () => ({
          amount: ex.per_round[0].amount,
          weight: 0,
        })),
      })),
    })

    renderWithProviders(
      <BlockEditor
        open
        onOpenChange={vi.fn()}
        block={tours}
        dayId="day-1"
        onMutationStateChange={vi.fn()}
      />,
    )

    await user.click(screen.getByRole("radio", { name: /AMRAP 20 min/i }))

    await waitFor(() => {
      const blockUpdate = updates.find((u) => u.table === "exercise_blocks")
      expect(blockUpdate?.payload).toEqual(
        expect.objectContaining({
          mode: "amrap",
          cap_seconds: 1200,
          rounds: 1,
          rest_seconds: 0,
          transition_seconds: 0,
        }),
      )
    })

    const exerciseUpdates = updates.filter((u) => u.table === "block_exercises")
    expect(exerciseUpdates).toHaveLength(3)
    expect(
      exerciseUpdates.map((u) => {
        if (
          typeof u.payload !== "object" ||
          u.payload === null ||
          !("per_round" in u.payload)
        ) {
          return null
        }
        return u.payload.per_round
      }),
    ).toEqual([
      [{ amount: 5, weight: 0 }],
      [{ amount: 10, weight: 0 }],
      [{ amount: 15, weight: 0 }],
    ])
  })

  it("persists a 10 min cap in one gesture from the default 20", async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <BlockEditor
        open
        onOpenChange={vi.fn()}
        block={makeBlock()}
        dayId="day-1"
        onMutationStateChange={vi.fn()}
      />,
    )

    const minutes = screen.getByLabelText(/minutes/i)
    await user.clear(minutes)
    await user.type(minutes, "10")

    await waitFor(() => {
      const blockUpdate = updates
        .filter((u) => u.table === "exercise_blocks")
        .at(-1)
      expect(blockUpdate?.payload).toEqual(
        expect.objectContaining({
          mode: "amrap",
          cap_seconds: 600,
          rounds: 1,
        }),
      )
    })
  })
})
