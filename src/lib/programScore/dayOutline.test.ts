import { describe, expect, it } from "vitest"
import { formatDayOutlineLine, outlineDaysFromRows } from "./dayOutline"
import type { ProgramDayOutline, SlimDayRow } from "./types"

const EMPTY_DAY: ProgramDayOutline = {
  id: "1",
  emoji: "🔥",
  label: "Push",
  items: [],
}

describe("formatDayOutlineLine", () => {
  it("joins emoji and label the way a week is spoken", () => {
    expect(
      formatDayOutlineLine([
        EMPTY_DAY,
        { id: "2", emoji: "💪", label: "Pull", items: [] },
        { id: "3", emoji: "🦵", label: "Legs", items: [] },
      ]),
    ).toBe("🔥 Push · 💪 Pull · 🦵 Legs")
  })

  it("drops a missing emoji without a stray space", () => {
    expect(
      formatDayOutlineLine([{ id: "1", emoji: "", label: "Full body", items: [] }]),
    ).toBe("Full body")
  })
})

describe("outlineDaysFromRows", () => {
  it("keeps solo names and Circuit presence for the card peek", () => {
    const row: SlimDayRow = {
      id: "day-1",
      label: "Push",
      emoji: "🔥",
      sort_order: 0,
      workout_exercises: [
        {
          id: "we-1",
          sets: 3,
          rest_seconds: 90,
          reps: "8",
          muscle_snapshot: "Pectoraux",
          name_snapshot: "Développé couché",
          emoji_snapshot: "🏋️",
          sort_order: 0,
          exercise: {
            muscle_group: "Pectoraux",
            secondary_muscles: ["Triceps"],
            equipment: "barbell",
            name: "Développé couché",
            name_en: "Bench Press",
          },
        },
      ],
      exercise_blocks: [
        {
          id: "blk-1",
          label: "Cindy",
          mode: "amrap",
          cap_seconds: 1200,
          rounds: 0,
          sort_order: 1,
          exercises: [
            { muscle_snapshot: "Dos", exercise: null },
            { muscle_snapshot: "Pectoraux", exercise: null },
          ],
        },
      ],
    }

    expect(outlineDaysFromRows([row])).toEqual([
      {
        id: "day-1",
        emoji: "🔥",
        label: "Push",
        items: [
          {
            kind: "solo",
            id: "we-1",
            emoji: "🏋️",
            name_snapshot: "Développé couché",
            exercise: { name: "Développé couché", name_en: "Bench Press" },
            sets: 3,
            reps: "8",
            sortOrder: 0,
          },
          {
            kind: "circuit",
            id: "blk-1",
            label: "Cindy",
            rounds: 0,
            exerciseCount: 2,
            sortOrder: 1,
          },
        ],
      },
    ])
  })
})
