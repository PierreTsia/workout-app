import { describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import type { ProgramDayCard } from "@/hooks/useProgramDayCards"
import type { Exercise } from "@/types/database"
import { ProgramDayRow } from "./ProgramDayRow"

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }))

const { BENCH_ID, BENCH, PULL_ID, PULL } = vi.hoisted(() => {
  const benchId = "ex-bench"
  const pullId = "ex-pull"
  const bench: Exercise = {
    id: benchId,
    name: "Développé couché",
    muscle_group: "Pectoraux",
    emoji: "🏋️",
    is_system: true,
    created_at: "2026-01-01T00:00:00Z",
    youtube_url: null,
    instructions: {
      setup: ["Allonge-toi sur le banc"],
      movement: ["Pousse la barre"],
      breathing: ["Expire à la poussée"],
      common_mistakes: ["Coudes trop écartés"],
    },
    instructions_en: {
      setup: ["Lie back on the bench"],
      movement: ["Press the bar up"],
      breathing: ["Exhale on the push"],
      common_mistakes: ["Flared elbows"],
    },
    instructions_en_status: "clean",
    image_url: null,
    equipment: "barbell",
    difficulty_level: null,
    name_en: "Bench Press",
    source: "wger:73",
    secondary_muscles: null,
    reviewed_at: null,
    reviewed_by: null,
  }
  const pull: Exercise = {
    ...bench,
    id: pullId,
    name: "Tractions",
    muscle_group: "Dos",
    emoji: "🏋️",
    name_en: "Pull-ups",
    instructions: {
      setup: ["Accroche-toi à la barre"],
      movement: ["Tire jusqu’au menton"],
      breathing: ["Expire à la montée"],
      common_mistakes: ["Épaules trop hautes"],
    },
    instructions_en: {
      setup: ["Hang from the bar"],
      movement: ["Pull until your chin clears"],
      breathing: ["Exhale on the way up"],
      common_mistakes: ["Shrugging the shoulders"],
    },
  }
  return { BENCH_ID: benchId, BENCH: bench, PULL_ID: pullId, PULL: pull }
})

vi.mock("@/hooks/useExerciseById", () => ({
  useExerciseById: (id: string | null) => ({
    data: id === BENCH_ID ? BENCH : id === PULL_ID ? PULL : null,
    isPending: false,
  }),
}))

function makeDay(overrides: Partial<ProgramDayCard> = {}): ProgramDayCard {
  return {
    id: "day-1",
    emoji: "🔥",
    name: "Push",
    label: "🔥 Push",
    exerciseCount: 2,
    items: [
      {
        kind: "solo",
        id: "we-1",
        emoji: "🏋️",
        name: "Bench Press",
        sets: 3,
        reps: "8",
        restSeconds: 90,
        sortOrder: 0,
        exerciseId: BENCH_ID,
      },
      {
        kind: "circuit",
        id: "blk-1",
        label: "Cindy",
        rounds: 0,
        exerciseCount: 1,
        sortOrder: 1,
        stations: [
          {
            id: "be-1",
            name: "Pull-ups",
            emoji: "🏋️",
            amounts: [5],
            isDuration: false,
            exerciseId: PULL_ID,
          },
        ],
      },
    ],
    ...overrides,
  }
}

describe("ProgramDayRow", () => {
  it("summarizes the day without listing each exercise until expanded", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProgramDayRow day={makeDay()} index={1} />)

    expect(screen.getByText("Push")).toBeInTheDocument()
    expect(screen.getByText("Day 1")).toBeInTheDocument()
    expect(screen.getByText(/2 exercises/)).toBeInTheDocument()
    expect(screen.getByText(/3 sets/)).toBeInTheDocument()
    expect(screen.queryByText(/Bench Press/)).not.toBeInTheDocument()
    expect(screen.queryByText("Cindy")).not.toBeInTheDocument()
    expect(screen.queryByText("Pull-ups")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Push/ }))
    expect(screen.getByText(/Bench Press/)).toBeInTheDocument()
    expect(screen.getByText("Cindy")).toBeInTheDocument()
    expect(screen.getByText("Pull-ups")).toBeInTheDocument()
    expect(screen.getByText("5 reps")).toBeInTheDocument()
  })

  it("edits that day from the pencil, not the whole row", () => {
    renderWithProviders(
      <ProgramDayRow
        day={makeDay()}
        index={1}
        to="/builder/p-1"
        linkState={{ dayId: "day-1", from: "/programs/p-1" }}
      />,
    )

    expect(screen.getByRole("link", { name: "Edit Push" })).toHaveAttribute(
      "href",
      "/builder/p-1",
    )
    expect(screen.queryByRole("link", { name: "🔥 Push" })).not.toBeInTheDocument()
  })

  it("opens catalog instructions for a solo and a circuit station", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProgramDayRow day={makeDay()} index={1} />)

    await user.click(screen.getByRole("button", { name: /Push/ }))
    expect(
      screen.queryByRole("button", { name: /Cindy/ }),
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole("button", { name: "Instructions: Bench Press" }),
    )
    expect(screen.getByText("Lie back on the bench")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Close" }))
    await user.click(
      screen.getByRole("button", { name: "Instructions: Pull-ups" }),
    )
    expect(screen.getByText("Hang from the bar")).toBeInTheDocument()
    expect(screen.getByText("Pull until your chin clears")).toBeInTheDocument()
  })

  it("labels circuit station amounts as reps or seconds, not a naked count", async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <ProgramDayRow
        day={makeDay({
          items: [
            {
              kind: "circuit",
              id: "blk-1",
              label: "Bear Bird Hollow",
              rounds: 3,
              exerciseCount: 2,
              sortOrder: 0,
              stations: [
                {
                  id: "be-1",
                  name: "Bear walk",
                  emoji: "🔥",
                  amounts: [10],
                  isDuration: false,
                  exerciseId: PULL_ID,
                },
                {
                  id: "be-2",
                  name: "Hollow hold",
                  emoji: "🔥",
                  amounts: [30],
                  isDuration: true,
                },
              ],
            },
          ],
        })}
        index={1}
      />,
    )

    await user.click(screen.getByRole("button", { name: /Push/ }))
    expect(screen.getByText("10 reps")).toBeInTheDocument()
    expect(screen.getByText("30s")).toBeInTheDocument()
  })

  it("shows empty-day copy when there is nothing to expand into", async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <ProgramDayRow
        day={makeDay({ exerciseCount: 0, items: [] })}
        index={2}
      />,
    )

    await user.click(screen.getByRole("button", { name: /Push/ }))
    expect(screen.getByText("Nothing on this day yet.")).toBeInTheDocument()
  })

  it("hides the day pencil when the program cannot be edited", () => {
    renderWithProviders(<ProgramDayRow day={makeDay()} index={1} />)

    expect(
      screen.queryByRole("link", { name: "Edit Push" }),
    ).not.toBeInTheDocument()
  })

  it("indexes the day in French", () => {
    renderWithProviders(<ProgramDayRow day={makeDay()} index={1} />, {
      locale: "fr",
    })

    expect(screen.getByText("Jour 1")).toBeInTheDocument()
    expect(screen.getByText(/2 exercices/)).toBeInTheDocument()
  })
})
