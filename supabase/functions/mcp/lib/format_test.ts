import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts"
import {
  formatCircuitPreviewLines,
  formatPrescriptionLine,
  formatSessionSummary,
  formatWorkoutHistory,
  formatWeightConvention,
  type WeightConvention,
} from "./format.ts"
import type { CatalogExerciseForProgram } from "./programPersistence.ts"
import type { ParsedExercise } from "./createProgramValidation.ts"
import type { BlockHistoryGroup } from "./sessionHistoryGrouping.ts"

const KNOWN_EQUIPMENT: Array<[string, WeightConvention]> = [
  ["dumbbell", "per_hand"],
  ["kettlebell", "per_hand"],
  ["barbell", "total"],
  ["machine", "total"],
  ["cable", "total"],
  ["bodyweight", "bodyweight"],
  ["band", "total"],
  ["other", "total"],
]

for (const [equipment, expected] of KNOWN_EQUIPMENT) {
  Deno.test(`formatWeightConvention maps known equipment "${equipment}" to "${expected}" without warning`, () => {
    const warnings: unknown[][] = []
    const original = console.warn
    console.warn = (...args: unknown[]) => {
      warnings.push(args)
    }
    try {
      const convention = formatWeightConvention(equipment)
      assertEquals(convention, expected)
      assertEquals(warnings.length, 0)
    } finally {
      console.warn = original
    }
  })
}

Deno.test("formatWeightConvention falls back to 'total' AND warns when equipment is unknown", () => {
  const warnings: unknown[][] = []
  const original = console.warn
  console.warn = (...args: unknown[]) => {
    warnings.push(args)
  }
  try {
    const convention = formatWeightConvention("flux-capacitor")
    assertEquals(convention, "total")
    assertEquals(warnings.length, 1)
    const [firstArg] = warnings[0]
    assertEquals(typeof firstArg === "string" && firstArg.includes("flux-capacitor"), true)
  } finally {
    console.warn = original
  }
})

Deno.test("formatWeightConvention falls back to 'total' AND warns on the empty string (defensive)", () => {
  const warnings: unknown[][] = []
  const original = console.warn
  console.warn = (...args: unknown[]) => {
    warnings.push(args)
  }
  try {
    const convention = formatWeightConvention("")
    assertEquals(convention, "total")
    assertEquals(warnings.length, 1)
  } finally {
    console.warn = original
  }
})

Deno.test("formatPrescriptionLine renders barbell linear with 'X kg total'", () => {
  const line = formatPrescriptionLine({
    exerciseName: "Bench Press",
    sets: 4,
    reps: "8",
    weightKg: 80,
    restSeconds: 120,
    weightConvention: "total",
  })
  assertEquals(line, "Bench Press — 4 × 8 × 80 kg total — 120s rest")
})

Deno.test("formatPrescriptionLine renders dumbbell double-progression with 'X kg per hand'", () => {
  const line = formatPrescriptionLine({
    exerciseName: "DB Curl",
    sets: 4,
    reps: "8-12",
    weightKg: 15,
    restSeconds: 90,
    weightConvention: "per_hand",
  })
  assertEquals(line, "DB Curl — 4 × 8-12 × 15 kg per hand — 90s rest")
})

Deno.test("formatPrescriptionLine renders bodyweight with '(bodyweight)' and no kg suffix", () => {
  const line = formatPrescriptionLine({
    exerciseName: "Pushup",
    sets: 4,
    reps: "12",
    weightKg: 0,
    restSeconds: 90,
    weightConvention: "bodyweight",
  })
  assertEquals(line, "Pushup — 4 × 12 (bodyweight) — 90s rest")
})

Deno.test("formatPrescriptionLine renders fractional weight using one decimal", () => {
  const line = formatPrescriptionLine({
    exerciseName: "DB Curl",
    sets: 3,
    reps: "10",
    weightKg: 22.5,
    restSeconds: 60,
    weightConvention: "per_hand",
  })
  assertEquals(line, "DB Curl — 3 × 10 × 22.5 kg per hand — 60s rest")
})

Deno.test("formatPrescriptionLine renders duration mode as '{sets} × {N}s' (T75)", () => {
  const line = formatPrescriptionLine({
    exerciseName: "Plank",
    sets: 4,
    reps: "0",
    weightKg: 0,
    restSeconds: 60,
    weightConvention: "bodyweight",
    targetDurationSeconds: 30,
  })
  assertEquals(line, "Plank — 4 × 30s — 60s rest")
})

Deno.test("formatPrescriptionLine duration mode ignores reps/weightKg defensively", () => {
  const line = formatPrescriptionLine({
    exerciseName: "Plank",
    sets: 3,
    reps: "12",
    weightKg: 50,
    restSeconds: 60,
    weightConvention: "total",
    targetDurationSeconds: 45,
  })
  assertEquals(line, "Plank — 3 × 45s — 60s rest")
})

Deno.test("T195: finished Cindy history keeps glossed 27+3 and surfaces the shared PB", () => {
  const cindy: BlockHistoryGroup = {
    kind: "block",
    key: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    label: "Cindy",
    sortOrder: 0,
    exerciseCount: 3,
    amrapScore: { fullRounds: 27, leftover: 3, leftoverName: "pompes" },
    isPb: true,
    deltaRounds: 2,
    rounds: [
      {
        round: 28,
        cells: [
          {
            blockExerciseId: "be1",
            exercise_name_snapshot: "pompes",
            emoji: null,
            log: {
              id: "1",
              exercise_id: "a",
              block_exercise_id: "be1",
              exercise_name_snapshot: "pompes",
              set_number: 28,
              reps_logged: "3",
              duration_seconds: null,
              weight_logged: 0,
              was_pr: false,
              logged_at: "2026-08-15T10:19:00Z",
            },
          },
        ],
      },
    ],
  }

  const md = formatSessionSummary(
    {
      workout_label_snapshot: "Cindy",
      started_at: "2026-08-15T10:00:00.000Z",
      finished_at: "2026-08-15T10:20:00.000Z",
      active_duration_ms: 1_200_000,
      total_sets_done: 82,
    },
    [],
    undefined,
    [cindy],
  )

  assertStringIncludes(md, "27+3")
  assertStringIncludes(md, "27 tours · 3 pompes")
  assertStringIncludes(md, "27 rounds · 3 pompes")
  assertStringIncludes(md, "PB")
  assertStringIncludes(md, "+2 rounds vs last")
})

const ID_PULL = "11111111-1111-4111-8111-111111111111"
const ID_PUSH = "22222222-2222-4222-8222-222222222222"

const previewCatalog = new Map<string, CatalogExerciseForProgram>([
  [
    ID_PULL,
    {
      id: ID_PULL,
      name: "Tractions",
      muscle_group: "back",
      emoji: null,
      equipment: "bodyweight",
      measurement_type: "reps",
      default_duration_seconds: null,
    },
  ],
  [
    ID_PUSH,
    {
      id: ID_PUSH,
      name: "Pompes",
      muscle_group: "chest",
      emoji: null,
      equipment: "bodyweight",
      measurement_type: "reps",
      default_duration_seconds: null,
    },
  ],
])

function cindyParsed(
  over: Partial<Extract<ParsedExercise, { kind: "circuit" }>> = {},
): Extract<ParsedExercise, { kind: "circuit" }> {
  return {
    kind: "circuit",
    label: "Cindy",
    mode: "amrap",
    capMinutes: 20,
    rounds: 1,
    restSeconds: 0,
    transitionSeconds: 0,
    exercises: [
      { mode: "flat", exerciseId: ID_PULL, amount: 5, weightKg: 0 },
      { mode: "flat", exerciseId: ID_PUSH, amount: 10, weightKg: 0 },
    ],
    ...over,
  }
}

Deno.test("T195: dry_run / details preview echoes benchmark_slug: cindy when linked", () => {
  const lines = formatCircuitPreviewLines(
    cindyParsed({ benchmarkSlug: "cindy" }),
    previewCatalog,
  )
  const rendered = lines.join("\n")
  assertStringIncludes(rendered, 'benchmark_slug: "cindy"')
})

Deno.test("T195: two Cindy sessions format as one catalog identity with shared PB", () => {
  const cindyId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
  const metaTue = {
    blockId: "block-tuesday",
    label: "Cindy",
    position: 0,
    emoji: null,
    blockSortOrder: 0,
    mode: "amrap" as const,
  }
  const log = (
    sessionId: string,
    beId: string,
    setNumber: number,
    reps: string,
  ) => ({
    id: `${sessionId}-${setNumber}`,
    exercise_id: "a",
    block_exercise_id: beId,
    exercise_name_snapshot: "pompes",
    set_number: setNumber,
    reps_logged: reps,
    duration_seconds: null,
    weight_logged: 0,
    was_pr: false,
    logged_at: "2026-08-15T10:19:00Z",
  })
  const md = formatWorkoutHistory(
    [
      {
        id: "s1",
        workout_label_snapshot: "Cindy Tue",
        started_at: "2026-08-01T10:00:00.000Z",
        finished_at: "2026-08-01T10:20:00.000Z",
        active_duration_ms: 1_200_000,
        total_sets_done: 76,
      },
      {
        id: "s2",
        workout_label_snapshot: "Cindy Next",
        started_at: "2026-08-15T10:00:00.000Z",
        finished_at: "2026-08-15T10:20:00.000Z",
        active_duration_ms: 1_200_000,
        total_sets_done: 82,
      },
    ],
    new Map([
      ["s1", [log("s1", "be-tue", 26, "8")]],
      ["s2", [log("s2", "be-next", 28, "3")]],
    ]),
    new Map([
      ["be-tue", metaTue],
      ["be-next", { ...metaTue, blockId: "block-next-month" }],
    ]),
    [
      {
        session_id: "s1",
        block_id: "block-tuesday",
        finished_at: "2026-08-01T10:20:00.000Z",
        mode: "amrap",
        started_at: "2026-08-01T10:00:00.000Z",
        template_fingerprint: "amrap|1200|ex-1:5:0,ex-2:10:0,ex-3:15:0",
        benchmark_circuit_id: cindyId,
      },
      {
        session_id: "s2",
        block_id: "block-next-month",
        finished_at: "2026-08-15T10:20:00.000Z",
        mode: "amrap",
        started_at: "2026-08-15T10:00:00.000Z",
        template_fingerprint: "amrap|1200|ex-1:5:0,ex-2:10:0,ex-3:15:0",
        benchmark_circuit_id: cindyId,
      },
    ],
  )

  assertStringIncludes(md, "27+3")
  assertStringIncludes(md, "27 tours · 3 pompes")
  assertStringIncludes(md, "PB")
  assertStringIncludes(md, "+2 rounds vs last")
  assertEquals(md.includes("CCT"), false)
})

Deno.test("T195: generic / Zeus Circuit preview has no slug and does not coerce one", () => {
  const lines = formatCircuitPreviewLines(
    cindyParsed({ label: "Zeus", benchmarkSlug: null, benchmarkCircuitId: null }),
    previewCatalog,
  )
  const rendered = lines.join("\n")
  assertEquals(rendered.includes("benchmark_slug"), false)
  assertEquals(rendered.includes("cindy"), false)
})
