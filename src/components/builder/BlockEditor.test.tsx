import { vi, describe, it, expect, beforeEach } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { BlockEditor } from "@/components/builder/BlockEditor"
import { authAtom } from "@/store/atoms"
import type { ExerciseBlockWithExercises } from "@/types/database"

const CINDY_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
const updates: { table: string; payload: unknown }[] = []
const inserts: { table: string; payload: unknown }[] = []
const catalogLookup = vi.hoisted(() => ({ fail: false }))

const CINDY_CATALOG = {
  id: CINDY_ID,
  owner_id: null,
  label: "Cindy",
  aliases: ["holland"],
  tagline_fr: "Le WOD de Tom Holland. 20 min.",
  tagline_en: "Tom Holland’s WOD. 20 min.",
  story_fr: null,
  story_en: null,
  reference: { name: "Tom Holland", score: "27" },
  rx: {
    mode: "amrap" as const,
    cap_seconds: 1200,
    exercises: [
      { exercise_id: "ex-pull", amount: 5, weight: 0 },
      { exercise_id: "ex-push", amount: 10, weight: 0 },
      { exercise_id: "ex-squat", amount: 15, weight: 0 },
    ],
  },
}

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: (_column: string, id: string) => ({
          single: () => {
            if (table === "benchmark_circuits" && catalogLookup.fail) {
              return Promise.resolve({ data: null, error: { message: "miss" } })
            }
            return Promise.resolve({
              data:
                table === "benchmark_circuits"
                  ? id === CINDY_ID
                    ? CINDY_CATALOG
                    : { ...CINDY_CATALOG, id, owner_id: "user-1" }
                  : null,
              error: null,
            })
          },
        }),
      }),
      insert: (payload: unknown) => {
        inserts.push({ table, payload })
        return {
          select: () => ({
            single: () =>
              Promise.resolve({ data: { id: "fork-new" }, error: null }),
          }),
        }
      },
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

const TEST_USER = { id: "user-1" }

describe("BlockEditor", () => {
  beforeEach(() => {
    updates.length = 0
    inserts.length = 0
    catalogLookup.fail = false
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
    expect(
      screen.getByRole("radio", { name: /time is the score/i }),
    ).toHaveAttribute("data-state", "off")
    expect(screen.getByText("As many rounds as possible.")).toBeInTheDocument()
    expect(screen.getByText("Time is the score.")).toBeInTheDocument()
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

  it("does not persist a Cindy cap edit under the seed id — cancel writes nothing", async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(
      <BlockEditor
        open
        onOpenChange={vi.fn()}
        block={makeBlock({ benchmark_circuit_id: CINDY_ID })}
        dayId="day-1"
        onMutationStateChange={vi.fn()}
      />,
    )
    store.set(authAtom, TEST_USER as never)

    const minutes = screen.getByLabelText(/minutes/i)
    await user.clear(minutes)
    await user.type(minutes, "10")

    await waitFor(() => {
      expect(
        screen.getByRole("alertdialog", { name: /this will no longer be cindy/i }),
      ).toBeInTheDocument()
    })

    expect(inserts).toEqual([])
    expect(updates).toEqual([])

    await user.click(screen.getByRole("button", { name: /cancel/i }))

    expect(inserts).toEqual([])
    expect(updates).toEqual([])
    expect(screen.getByLabelText(/minutes/i)).toHaveValue(20)
  })

  it("confirms a Cindy cap fork then persists onto the retargeted block", async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(
      <BlockEditor
        open
        onOpenChange={vi.fn()}
        block={makeBlock({ benchmark_circuit_id: CINDY_ID })}
        dayId="day-1"
        onMutationStateChange={vi.fn()}
      />,
    )
    store.set(authAtom, TEST_USER as never)

    const minutes = screen.getByLabelText(/minutes/i)
    await user.clear(minutes)
    await user.type(minutes, "10")

    await waitFor(() => {
      expect(
        screen.getByRole("alertdialog", { name: /this will no longer be cindy/i }),
      ).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: /continue/i }))

    await waitFor(() => {
      expect(inserts).toHaveLength(1)
    })

    expect(inserts[0]).toEqual({
      table: "benchmark_circuits",
      payload: expect.objectContaining({
        slug: null,
        owner_id: "user-1",
        forked_from: CINDY_ID,
        rx: expect.objectContaining({
          mode: "amrap",
          cap_seconds: 600,
        }),
      }),
    })

    const retarget = updates.find((u) => {
      if (u.table !== "exercise_blocks") return false
      if (typeof u.payload !== "object" || u.payload === null) return false
      return "benchmark_circuit_id" in u.payload
    })
    expect(retarget?.payload).toEqual({ benchmark_circuit_id: "fork-new" })

    const capWrite = updates.find((u) => {
      if (u.table !== "exercise_blocks") return false
      if (typeof u.payload !== "object" || u.payload === null) return false
      return "cap_seconds" in u.payload
    })
    expect(capWrite?.payload).toEqual(
      expect.objectContaining({
        mode: "amrap",
        cap_seconds: 600,
        rounds: 1,
      }),
    )

    const blockUpdates = updates.filter((u) => u.table === "exercise_blocks")
    const writeKinds = blockUpdates.map((u) => {
      if (typeof u.payload !== "object" || u.payload === null) return "other"
      if ("cap_seconds" in u.payload) return "meta"
      if ("benchmark_circuit_id" in u.payload) return "retarget"
      return "other"
    })
    expect(writeKinds.filter((k) => k === "meta" || k === "retarget")).toEqual([
      "meta",
      "retarget",
    ])
  })

  it("mutates the private fork in place on a second cap edit in the same editor", async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(
      <BlockEditor
        open
        onOpenChange={vi.fn()}
        block={makeBlock({ benchmark_circuit_id: CINDY_ID })}
        dayId="day-1"
        onMutationStateChange={vi.fn()}
      />,
    )
    store.set(authAtom, TEST_USER as never)

    const minutes = screen.getByLabelText(/minutes/i)
    await user.clear(minutes)
    await user.type(minutes, "10")

    await waitFor(() => {
      expect(
        screen.getByRole("alertdialog", { name: /this will no longer be cindy/i }),
      ).toBeInTheDocument()
    })
    await user.click(screen.getByRole("button", { name: /continue/i }))
    await waitFor(() => {
      expect(inserts).toHaveLength(1)
    })

    await user.clear(minutes)
    await user.type(minutes, "12")

    await waitFor(() => {
      expect(
        updates.some((u) => {
          if (typeof u.payload !== "object" || u.payload === null) return false
          return "cap_seconds" in u.payload && u.payload.cap_seconds === 720
        }),
      ).toBe(true)
    })

    expect(
      screen.queryByRole("alertdialog", { name: /this will no longer be cindy/i }),
    ).not.toBeInTheDocument()
    expect(inserts).toHaveLength(1)
  })

  it("reports a save error and restores the cap when the catalog cannot be loaded", async () => {
    catalogLookup.fail = true
    const user = userEvent.setup()
    const onMutationStateChange = vi.fn()
    const { store } = renderWithProviders(
      <BlockEditor
        open
        onOpenChange={vi.fn()}
        block={makeBlock({ benchmark_circuit_id: CINDY_ID })}
        dayId="day-1"
        onMutationStateChange={onMutationStateChange}
      />,
    )
    store.set(authAtom, TEST_USER as never)

    const minutes = screen.getByLabelText(/minutes/i)
    await user.clear(minutes)
    await user.type(minutes, "10")

    await waitFor(() => {
      expect(onMutationStateChange).toHaveBeenCalledWith("error")
    })
    expect(screen.getByText(/syncing failed/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/minutes/i)).toHaveValue(20)
    expect(inserts).toEqual([])
    expect(updates).toEqual([])
  })

  it("does not persist a seed amount edit from the uniform list under the seed id", async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(
      <BlockEditor
        open
        onOpenChange={vi.fn()}
        block={makeBlock({ benchmark_circuit_id: CINDY_ID })}
        dayId="day-1"
        onMutationStateChange={vi.fn()}
      />,
    )
    store.set(authAtom, TEST_USER as never)

    const pullReps = screen.getByLabelText(/reps pull-up/i)
    await user.clear(pullReps)
    await user.type(pullReps, "6")

    await waitFor(() => {
      expect(
        screen.getByRole("alertdialog", { name: /this will no longer be cindy/i }),
      ).toBeInTheDocument()
    })
    expect(inserts).toEqual([])
    expect(updates).toEqual([])
  })
})
