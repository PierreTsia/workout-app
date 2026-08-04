import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { ProgramDetailSheet } from "./ProgramDetailSheet"
import type { Program } from "@/types/onboarding"

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from "@/lib/supabase"

const PROGRAM: Program = {
  id: "prog-1",
  name: "HIIT Bodyweight 2J",
  created_at: "2026-08-04T10:00:00Z",
  archived_at: null,
  is_active: true,
  user_id: "u1",
  template_id: null,
}

function mockDaysQuery(days: unknown[]) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: days, error: null }),
  }
  vi.mocked(supabase.from).mockReturnValue(chain as never)
  return chain
}

describe("ProgramDetailSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("#454: renders Circuits from exercise_blocks in program day cards", async () => {
    mockDaysQuery([
      {
        id: "day-a",
        emoji: "🔥",
        label: "Jour A — Haut",
        sort_order: 0,
        workout_exercises: [
          {
            id: "we-1",
            emoji_snapshot: "🔥",
            name_snapshot: "Gainage planche",
            sets: 3,
            reps: "0",
            rest_seconds: 30,
            sort_order: 1,
            exercise: null,
          },
        ],
        exercise_blocks: [
          {
            id: "blk-1",
            label: "Force Haut",
            rounds: 4,
            sort_order: 0,
            rest_seconds: 90,
            transition_seconds: 0,
            workout_day_id: "day-a",
            created_at: "",
            exercises: [
              {
                id: "be-1",
                position: 0,
                exercise_id: "ex-1",
                name_snapshot: "Pompes",
                emoji_snapshot: "💪",
                muscle_snapshot: "chest",
                per_round: [],
                block_id: "blk-1",
                exercise: null,
              },
              {
                id: "be-2",
                position: 1,
                exercise_id: "ex-2",
                name_snapshot: "Row",
                emoji_snapshot: "💪",
                muscle_snapshot: "back",
                per_round: [],
                block_id: "blk-1",
                exercise: null,
              },
            ],
          },
        ],
      },
    ])

    renderWithProviders(
      <ProgramDetailSheet
        program={PROGRAM}
        open
        onOpenChange={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText("Force Haut")).toBeInTheDocument()
    })
    expect(screen.getByTestId("day-card-circuit-blk-1")).toBeInTheDocument()
    expect(screen.getByText(/2 exercises · 4 rounds/i)).toBeInTheDocument()
    expect(screen.getByText(/Gainage planche/)).toBeInTheDocument()
    // Circuit + solo = 2 items on the day badge
    expect(screen.getByText("2 exercises")).toBeInTheDocument()

    const selectArg = vi.mocked(supabase.from).mock.results[0]?.value?.select
      ?.mock?.calls?.[0]?.[0] as string | undefined
    expect(selectArg).toContain("exercise_blocks")
  })
})
