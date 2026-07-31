import { describe, it, expect, vi } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { BlockHistoryCard } from "./BlockHistoryCard"
import type { BlockHistoryGroup } from "@/lib/sessionHistoryGrouping"
import type { ExerciseLabelFields, SetLogWithExercise } from "@/types/database"

function makeLog(
  overrides: Partial<SetLogWithExercise> = {},
): SetLogWithExercise {
  return {
    id: crypto.randomUUID(),
    session_id: "sess-1",
    exercise_id: "ex-1",
    block_exercise_id: "be1",
    exercise_name_snapshot: "Burpees",
    set_number: 1,
    reps_logged: "10",
    duration_seconds: null,
    weight_logged: 0,
    estimated_1rm: null,
    was_pr: false,
    logged_at: "2026-06-15T10:00:00.000Z",
    rir: null,
    rest_seconds: null,
    exercise: null,
    ...overrides,
  }
}

const catalogRow = (name: string, name_en: string): ExerciseLabelFields => ({
  id: "ex-1",
  name,
  name_en,
  muscle_group: "Pectoraux",
  equipment: "bodyweight",
  emoji: "🔥",
})

/** 2 exercises × 2 rounds, spanning 10:00:00 → 10:04:32 (272s) — a full grid. */
function makeCompleteGroup(): BlockHistoryGroup {
  const cell = (beId: string, name: string, round: number, at: string) => ({
    blockExerciseId: beId,
    exercise: null,
    exercise_name_snapshot: name,
    emoji: "🔥",
    log: makeLog({ block_exercise_id: beId, set_number: round, logged_at: at }),
  })
  return {
    kind: "block",
    key: "block-1",
    label: "Zeus",
    sortOrder: 0,
    exerciseCount: 2,
    rounds: [
      {
        round: 1,
        cells: [
          cell("be1", "Burpees", 1, "2026-06-15T10:00:00.000Z"),
          cell("be2", "Lunges", 1, "2026-06-15T10:01:30.000Z"),
        ],
      },
      {
        round: 2,
        cells: [
          cell("be1", "Burpees", 2, "2026-06-15T10:03:00.000Z"),
          cell("be2", "Lunges", 2, "2026-06-15T10:04:32.000Z"),
        ],
      },
    ],
  }
}

describe("BlockHistoryCard", () => {
  it("shows the completion time for a complete run", () => {
    renderWithProviders(
      <BlockHistoryCard group={makeCompleteGroup()} formatWeight={(kg) => `${kg} kg`} />,
    )

    expect(screen.getByText(/4:32/)).toBeInTheDocument()
  })

  it("calls onOpen with the group when tapped", async () => {
    const onOpen = vi.fn()
    const group = makeCompleteGroup()
    renderWithProviders(
      <BlockHistoryCard group={group} formatWeight={(kg) => `${kg} kg`} onOpen={onOpen} />,
    )

    await userEvent.click(screen.getByRole("button"))

    expect(onOpen).toHaveBeenCalledWith(group)
  })

  it.each([
    ["en", "Jumping Jacks", "Pompes sautées"],
    ["fr", "Pompes sautées", "Jumping Jacks"],
  ] as const)(
    "labels circuit cells in %s",
    async (locale, expected, hidden) => {
      const group = makeCompleteGroup()
      group.rounds[0].cells[0].exercise = catalogRow(
        "Pompes sautées",
        "Jumping Jacks",
      )

      renderWithProviders(
        <BlockHistoryCard group={group} formatWeight={(kg) => `${kg} kg`} />,
        { locale },
      )

      expect(await screen.findByText(expected)).toBeInTheDocument()
      expect(screen.queryByText(hidden)).not.toBeInTheDocument()
    },
  )

  it("falls back to the snapshot when a cell has no catalog row", () => {
    renderWithProviders(
      <BlockHistoryCard group={makeCompleteGroup()} formatWeight={(kg) => `${kg} kg`} />,
      { locale: "en" },
    )

    expect(screen.getAllByText("Burpees").length).toBeGreaterThan(0)
  })

  it("shows no completion time for an incomplete run (ragged grid)", () => {
    const group = makeCompleteGroup()
    group.rounds[1].cells = [group.rounds[1].cells[0]] // drop the last cell of round 2

    renderWithProviders(
      <BlockHistoryCard group={group} formatWeight={(kg) => `${kg} kg`} />,
    )

    expect(screen.queryByText(/4:32/)).not.toBeInTheDocument()
  })
})
