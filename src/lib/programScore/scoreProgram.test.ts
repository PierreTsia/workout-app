import { describe, expect, it } from "vitest"
import { computeBalanceScore, MUSCLE_TAXONOMY } from "@/lib/trainingBalance"
import {
  ENDURANCE_CIRCUITS_OK,
  HYPERTROPHY_FREQUENCY_MIN,
  HYPERTROPHY_VOLUME_MIN,
  STRENGTH_REP_MAX,
  STRENGTH_REST_MIN_SECONDS,
} from "./bands"
import { scoreProgram } from "./scoreProgram"
import { toIntent } from "./toIntent"
import type {
  IntentCircuit,
  IntentSolo,
  ProgramIntent,
  ProgramIntentDay,
  SlimDayRow,
  SlimSoloRow,
} from "./types"

function emptyIntent(): ProgramIntent {
  return { programId: "prog-1", days: [] }
}

function makeSolo(overrides: Partial<IntentSolo> = {}): IntentSolo {
  return {
    sets: HYPERTROPHY_VOLUME_MIN,
    restSeconds: STRENGTH_REST_MIN_SECONDS - 1,
    repMax: STRENGTH_REP_MAX + 1,
    measurementType: "reps",
    primaryMuscle: "Pectoraux",
    secondaryMuscles: [],
    equipment: "barbell",
    ...overrides,
  }
}

function makeDay(
  overrides: Partial<ProgramIntentDay> = {},
): ProgramIntentDay {
  return {
    id: "day-1",
    label: "Push",
    sortOrder: 0,
    solos: [],
    circuits: [],
    ...overrides,
  }
}

function makeIntent(days: ProgramIntentDay[]): ProgramIntent {
  return { programId: "prog-1", days }
}

function cindyCircuit(): IntentCircuit {
  return {
    mode: "amrap",
    capSeconds: 20 * 60,
    stations: [
      {
        primaryMuscle: "Dos",
        secondaryMuscles: ["Biceps"],
        equipment: "bodyweight",
      },
      {
        primaryMuscle: "Pectoraux",
        secondaryMuscles: ["Triceps", "Épaules"],
        equipment: "bodyweight",
      },
      {
        primaryMuscle: "Quadriceps",
        secondaryMuscles: ["Fessiers"],
        equipment: "bodyweight",
      },
    ],
  }
}

function cindyBalanceVector(): number[] {
  const credit: Record<string, number> = {
    Dos: 1,
    Biceps: 0.5,
    Pectoraux: 1,
    Triceps: 0.5,
    Épaules: 0.5,
    Quadriceps: 1,
    Fessiers: 0.5,
  }
  return MUSCLE_TAXONOMY.map((muscle) => credit[muscle] ?? 0)
}

describe("scoreProgram", () => {
  it("scores an empty week as empty — not short — with zero facts", () => {
    const score = scoreProgram(emptyIntent())

    expect(score.hypertrophy.band).toBe("empty")
    expect(score.hypertrophy.volume).toBe("empty")
    expect(score.hypertrophy.frequency).toBe("empty")
    expect(score.strength.band).toBe("empty")
    expect(score.endurance.band).toBe("empty")
    expect(score.balance).toEqual({ kind: "empty" })
    expect(score.facts).toEqual({
      dayCount: 0,
      setCount: 0,
      circuitCount: 0,
      circuitModes: { amrap: 0, rounds: 0 },
      mix: { free: 0, machine: 0, bodyweight: 0, other: 0 },
    })
  })

  it("bands a 1-day solo week short on hypertrophy frequency — not empty", () => {
    const score = scoreProgram(
      makeIntent([
        makeDay({
          solos: [makeSolo({ sets: HYPERTROPHY_VOLUME_MIN })],
        }),
      ]),
    )

    expect(HYPERTROPHY_FREQUENCY_MIN).toBeGreaterThan(1)
    expect(score.hypertrophy.band).toBe("short")
    expect(score.hypertrophy.frequency).toBe("short")
    expect(score.hypertrophy.volume).not.toBe("empty")
    expect(score.hypertrophy.band).not.toBe("empty")
    expect(score.facts.dayCount).toBe(1)
    expect(score.facts.setCount).toBe(HYPERTROPHY_VOLUME_MIN)
    expect(score.facts.circuitCount).toBe(0)
    expect(score.balance.kind).toBe("score")
  })

  it("scores Cindy-only as endurance + Balance; hypertrophy volume and strength stay empty", () => {
    const score = scoreProgram(
      makeIntent([
        makeDay({
          id: "cindy",
          label: "Cindy",
          circuits: [cindyCircuit()],
        }),
      ]),
    )

    expect(score.endurance.band).not.toBe("empty")
    expect(score.endurance.band).toBe("ok")
    expect(score.hypertrophy.volume).toBe("empty")
    expect(score.hypertrophy.band).toBe("empty")
    expect(score.strength.band).toBe("empty")
    expect(score.facts.setCount).toBe(0)
    expect(score.facts.circuitCount).toBeGreaterThanOrEqual(ENDURANCE_CIRCUITS_OK)
    expect(score.facts.circuitCount).toBe(ENDURANCE_CIRCUITS_OK)
    expect(score.facts.circuitModes).toEqual({ amrap: 1, rounds: 0 })
    expect(score.facts.mix.bodyweight).toBe(cindyCircuit().stations.length)
    expect(score.balance).toEqual({
      kind: "score",
      value: computeBalanceScore(cindyBalanceVector()),
    })
  })

  it("treats a day with no items as empty — not short", () => {
    const score = scoreProgram(makeIntent([makeDay()]))

    expect(score.hypertrophy.band).toBe("empty")
    expect(score.strength.band).toBe("empty")
    expect(score.endurance.band).toBe("empty")
    expect(score.balance).toEqual({ kind: "empty" })
    expect(score.facts.dayCount).toBe(1)
    expect(score.facts.setCount).toBe(0)
    expect(score.facts.circuitCount).toBe(0)
  })

  it("is deterministic for the same intent", () => {
    const intent = makeIntent([
      makeDay({ solos: [makeSolo({ sets: HYPERTROPHY_VOLUME_MIN })] }),
    ])
    expect(scoreProgram(intent)).toEqual(scoreProgram(intent))
  })

  it("drops unknown muscle slugs instead of inventing an axis", () => {
    const score = scoreProgram(
      makeIntent([
        makeDay({
          solos: [
            makeSolo({
              primaryMuscle: "chest",
              secondaryMuscles: ["rear delt"],
            }),
          ],
        }),
      ]),
    )

    expect(score.hypertrophy.band).toBe("empty")
    expect(score.hypertrophy.volume).toBe("empty")
    expect(score.balance).toEqual({
      kind: "score",
      value: computeBalanceScore(MUSCLE_TAXONOMY.map(() => 0)),
    })
  })

  it("scores a PPL-shaped week as hypertrophy ok, strength and endurance short", () => {
    const hypertrophySolo = (
      overrides: Partial<IntentSolo> & Pick<IntentSolo, "primaryMuscle">,
    ): IntentSolo =>
      makeSolo({
        restSeconds: STRENGTH_REST_MIN_SECONDS - 1,
        repMax: STRENGTH_REP_MAX + 1,
        ...overrides,
      })

    const pushSolos = [
      hypertrophySolo({
        sets: 4,
        primaryMuscle: "Pectoraux",
        secondaryMuscles: ["Triceps"],
        equipment: "barbell",
      }),
      hypertrophySolo({
        sets: 3,
        primaryMuscle: "Épaules",
        secondaryMuscles: ["Triceps"],
        equipment: "barbell",
      }),
      hypertrophySolo({
        sets: 3,
        primaryMuscle: "Épaules",
        equipment: "dumbbell",
      }),
      hypertrophySolo({
        sets: 3,
        primaryMuscle: "Triceps",
        equipment: "cable",
      }),
    ]
    const pullSolos = [
      hypertrophySolo({
        sets: 4,
        primaryMuscle: "Dos",
        secondaryMuscles: ["Biceps"],
        equipment: "barbell",
      }),
      hypertrophySolo({
        sets: 3,
        primaryMuscle: "Dos",
        secondaryMuscles: ["Biceps"],
        equipment: "cable",
      }),
      hypertrophySolo({
        sets: 3,
        primaryMuscle: "Biceps",
        equipment: "dumbbell",
      }),
      hypertrophySolo({
        sets: 3,
        primaryMuscle: "Trapèzes",
        equipment: "cable",
      }),
    ]
    const legSolos = [
      hypertrophySolo({
        sets: 4,
        primaryMuscle: "Quadriceps",
        secondaryMuscles: ["Fessiers"],
        equipment: "barbell",
      }),
      hypertrophySolo({
        sets: 3,
        primaryMuscle: "Ischios",
        secondaryMuscles: ["Fessiers"],
        equipment: "barbell",
      }),
      hypertrophySolo({
        sets: 3,
        primaryMuscle: "Quadriceps",
        equipment: "machine",
      }),
      hypertrophySolo({
        sets: 3,
        primaryMuscle: "Mollets",
        equipment: "machine",
      }),
    ]

    const score = scoreProgram(
      makeIntent([
        makeDay({ id: "push-a", label: "Push A", sortOrder: 0, solos: pushSolos }),
        makeDay({ id: "pull-a", label: "Pull A", sortOrder: 1, solos: pullSolos }),
        makeDay({ id: "legs-a", label: "Legs A", sortOrder: 2, solos: legSolos }),
        makeDay({ id: "push-b", label: "Push B", sortOrder: 3, solos: pushSolos }),
        makeDay({ id: "pull-b", label: "Pull B", sortOrder: 4, solos: pullSolos }),
        makeDay({ id: "legs-b", label: "Legs B", sortOrder: 5, solos: legSolos }),
      ]),
    )

    expect(score.hypertrophy.band).toBe("ok")
    expect(score.hypertrophy.volume).toBe("ok")
    expect(score.hypertrophy.frequency).toBe("high")
    expect(score.strength.band).toBe("short")
    expect(score.endurance.band).toBe("short")
    expect(score.facts.dayCount).toBe(6)
    expect(score.facts.setCount).toBe(78)
    expect(score.facts.circuitCount).toBe(0)
    expect(score.facts.mix).toEqual({
      free: 48,
      machine: 30,
      bodyweight: 0,
      other: 0,
    })
    expect(score.balance.kind).toBe("score")
  })

  it("scores a 5×5-shaped week as strength high", () => {
    const strengthSolo = (
      overrides: Partial<IntentSolo> & Pick<IntentSolo, "primaryMuscle" | "sets">,
    ): IntentSolo =>
      makeSolo({
        restSeconds: STRENGTH_REST_MIN_SECONDS,
        repMax: STRENGTH_REP_MAX - 1,
        equipment: "barbell",
        ...overrides,
      })

    const dayA = [
      strengthSolo({
        sets: 5,
        primaryMuscle: "Quadriceps",
        secondaryMuscles: ["Fessiers"],
      }),
      strengthSolo({
        sets: 5,
        primaryMuscle: "Pectoraux",
        secondaryMuscles: ["Triceps"],
      }),
      strengthSolo({
        sets: 5,
        primaryMuscle: "Dos",
        secondaryMuscles: ["Biceps"],
      }),
    ]
    const dayB = [
      strengthSolo({
        sets: 5,
        primaryMuscle: "Quadriceps",
        secondaryMuscles: ["Fessiers"],
      }),
      strengthSolo({
        sets: 5,
        primaryMuscle: "Épaules",
        secondaryMuscles: ["Triceps"],
      }),
      strengthSolo({
        sets: 1,
        primaryMuscle: "Ischios",
        secondaryMuscles: ["Lombaires", "Fessiers"],
      }),
    ]

    const score = scoreProgram(
      makeIntent([
        makeDay({ id: "a1", label: "A", sortOrder: 0, solos: dayA }),
        makeDay({ id: "b1", label: "B", sortOrder: 1, solos: dayB }),
        makeDay({ id: "a2", label: "A", sortOrder: 2, solos: dayA }),
      ]),
    )

    expect(score.strength.band).toBe("high")
    expect(score.hypertrophy.band).toBe("ok")
    expect(score.hypertrophy.band).not.toBe("empty")
    expect(score.endurance.band).toBe("short")
    expect(score.facts.dayCount).toBe(3)
    expect(score.facts.setCount).toBe(41)
    expect(score.facts.circuitCount).toBe(0)
    expect(score.facts.mix).toEqual({
      free: 41,
      machine: 0,
      bodyweight: 0,
      other: 0,
    })
    expect(score.balance.kind).toBe("score")
  })

  it("never explodes Tours rounds into solo sets", () => {
    const tours: IntentCircuit = {
      mode: "rounds",
      capSeconds: null,
      stations: [
        {
          primaryMuscle: "Dos",
          secondaryMuscles: [],
          equipment: "bodyweight",
        },
      ],
    }

    const score = scoreProgram(
      makeIntent([makeDay({ id: "tours", circuits: [tours] })]),
    )

    expect(score.facts.setCount).toBe(0)
    expect(score.facts.circuitCount).toBe(1)
    expect(score.facts.circuitModes).toEqual({ amrap: 0, rounds: 1 })
    expect(score.strength.band).toBe("empty")
    expect(score.hypertrophy.volume).toBe("empty")
    expect(score.endurance.band).toBe("ok")
  })
})

function makeSlimSolo(overrides: Partial<SlimSoloRow> = {}): SlimSoloRow {
  return {
    sets: HYPERTROPHY_VOLUME_MIN,
    rest_seconds: STRENGTH_REST_MIN_SECONDS - 1,
    reps: String(STRENGTH_REP_MAX + 1),
    muscle_snapshot: "Pectoraux",
    exercise: {
      muscle_group: "Pectoraux",
      secondary_muscles: ["Triceps"],
      equipment: "barbell",
      measurement_type: "reps",
    },
    ...overrides,
  }
}

function makeSlimDay(overrides: Partial<SlimDayRow> = {}): SlimDayRow {
  return {
    id: "day-1",
    label: "Push",
    emoji: "🔥",
    sort_order: 0,
    workout_exercises: [],
    exercise_blocks: [],
    ...overrides,
  }
}

describe("toIntent", () => {
  it("prefers live muscle_group and falls back to the snapshot", () => {
    const intent = toIntent("prog-1", [
      makeSlimDay({
        workout_exercises: [
          makeSlimSolo({
            muscle_snapshot: "Dos",
            exercise: {
              muscle_group: "Pectoraux",
              secondary_muscles: ["Triceps"],
              equipment: "dumbbell",
              measurement_type: "reps",
            },
          }),
          makeSlimSolo({
            muscle_snapshot: "Quadriceps",
            exercise: null,
          }),
        ],
      }),
    ])

    expect(intent.days[0]?.solos[0]?.primaryMuscle).toBe("Pectoraux")
    expect(intent.days[0]?.solos[0]?.secondaryMuscles).toEqual(["Triceps"])
    expect(intent.days[0]?.solos[1]?.primaryMuscle).toBe("Quadriceps")
    expect(intent.days[0]?.solos[1]?.secondaryMuscles).toEqual([])
  })

  it("drops unknown muscle slugs and snapshot leftovers", () => {
    const intent = toIntent("prog-1", [
      makeSlimDay({
        workout_exercises: [
          makeSlimSolo({
            muscle_snapshot: "chest",
            exercise: {
              muscle_group: "chest",
              secondary_muscles: ["rear delt"],
              equipment: "barbell",
              measurement_type: "reps",
            },
          }),
        ],
      }),
    ])

    expect(intent.days[0]?.solos[0]?.primaryMuscle).toBeNull()
    expect(intent.days[0]?.solos[0]?.secondaryMuscles).toEqual([])
  })

  it("parses rep max through parseTargetRepRange", () => {
    const intent = toIntent("prog-1", [
      makeSlimDay({
        workout_exercises: [
          makeSlimSolo({
            reps: "8-10",
            rep_range_min: STRENGTH_REP_MAX,
            rep_range_max: STRENGTH_REP_MAX + 2,
          }),
        ],
      }),
    ])

    expect(intent.days[0]?.solos[0]?.repMax).toBe(STRENGTH_REP_MAX + 2)
  })

  it("maps a Circuit as one unit and ignores rounds on the row", () => {
    const intent = toIntent("prog-1", [
      makeSlimDay({
        exercise_blocks: [
          {
            mode: "rounds",
            cap_seconds: null,
            rounds: 5,
            exercises: [
              {
                muscle_snapshot: "Dos",
                exercise: {
                  muscle_group: "Dos",
                  secondary_muscles: ["Biceps"],
                  equipment: "bodyweight",
                  measurement_type: "reps",
                },
              },
            ],
          },
        ],
      }),
    ])

    expect(intent.days[0]?.circuits).toEqual([
      {
        mode: "rounds",
        capSeconds: null,
        stations: [
          {
            primaryMuscle: "Dos",
            secondaryMuscles: ["Biceps"],
            equipment: "bodyweight",
          },
        ],
      },
    ])
  })
})
