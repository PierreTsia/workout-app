import { describe, it, expect } from "vitest"
import {
  mapMuscleToSlugs,
  bucketBodyMapFrequencies,
  buildBodyMapData,
  buildSingleExerciseData,
} from "./muscleMapping"

describe("mapMuscleToSlugs", () => {
  const cases: [string, string[]][] = [
    ["Pectoraux", ["chest"]],
    ["Dos", ["upper-back"]],
    ["Épaules", ["front-deltoids", "back-deltoids"]],
    ["Biceps", ["biceps"]],
    ["Triceps", ["triceps"]],
    ["Quadriceps", ["quadriceps"]],
    ["Ischios", ["hamstring"]],
    ["Fessiers", ["gluteal"]],
    ["Adducteurs", ["adductor"]],
    ["Mollets", ["calves"]],
    ["Abdos", ["abs"]],
    ["Trapèzes", ["trapezius"]],
    ["Lombaires", ["lower-back"]],
  ]

  it.each(cases)("maps %s → %j", (taxonomy, expected) => {
    expect(mapMuscleToSlugs(taxonomy)).toEqual(expected)
  })

  it("returns empty array for unknown values", () => {
    expect(mapMuscleToSlugs("Deltoïdes post.")).toEqual([])
    expect(mapMuscleToSlugs("Ischios / Bas du dos")).toEqual([])
    expect(mapMuscleToSlugs("")).toEqual([])
  })
})

describe("buildSingleExerciseData", () => {
  it("returns primary at frequency 2 and secondaries at frequency 1", () => {
    const data = buildSingleExerciseData("Pectoraux", ["Épaules", "Triceps"])
    expect(data).toEqual([
      { name: "Pectoraux", muscles: ["chest"], frequency: 2 },
      {
        name: "Épaules",
        muscles: ["front-deltoids", "back-deltoids"],
        frequency: 1,
      },
      { name: "Triceps", muscles: ["triceps"], frequency: 1 },
    ])
  })

  it("handles null secondary muscles", () => {
    const data = buildSingleExerciseData("Biceps", null)
    expect(data).toEqual([
      { name: "Biceps", muscles: ["biceps"], frequency: 2 },
    ])
  })

  it("returns empty array for unmapped muscle group", () => {
    const data = buildSingleExerciseData("Unknown", null)
    expect(data).toEqual([])
  })
})

describe("buildBodyMapData", () => {
  it("aggregates frequency by set count", () => {
    const data = buildBodyMapData([
      { name: "Bench Press", muscleGroup: "Pectoraux", sets: 4 },
      { name: "Incline DB", muscleGroup: "Pectoraux", sets: 3 },
    ])

    const chest = data.find((d) => d.muscles.includes("chest"))
    expect(chest).toBeDefined()
    expect(chest!.frequency).toBe(7)
  })

  it("weights secondary muscles at ceil(sets / 2)", () => {
    const data = buildBodyMapData([
      {
        name: "Bench Press",
        muscleGroup: "Pectoraux",
        secondaryMuscles: ["Triceps"],
        sets: 4,
      },
    ])

    const triceps = data.find((d) => d.muscles.includes("triceps"))
    expect(triceps).toBeDefined()
    expect(triceps!.frequency).toBe(2) // ceil(4/2)
  })

  it("handles odd set count for secondary weight", () => {
    const data = buildBodyMapData([
      {
        name: "OHP",
        muscleGroup: "Épaules",
        secondaryMuscles: ["Triceps"],
        sets: 3,
      },
    ])

    const triceps = data.find((d) => d.muscles.includes("triceps"))
    expect(triceps!.frequency).toBe(2) // ceil(3/2)
  })

  it("returns empty array for empty input", () => {
    expect(buildBodyMapData([])).toEqual([])
  })

  it("skips unmapped muscles gracefully", () => {
    const data = buildBodyMapData([
      { name: "Mystery", muscleGroup: "Alien", sets: 4 },
    ])
    expect(data).toEqual([])
  })

  it("collects exercise names per slug", () => {
    const data = buildBodyMapData([
      { name: "Bench Press", muscleGroup: "Pectoraux", sets: 3 },
      { name: "Cable Fly", muscleGroup: "Pectoraux", sets: 3 },
    ])

    const chest = data.find((d) => d.muscles.includes("chest"))
    expect(chest!.name).toBe("Bench Press, Cable Fly")
  })
})

describe("bucketBodyMapFrequencies", () => {
  it("maps min..max raw frequencies to 1..bucketCount", () => {
    const data = [
      { name: "a", muscles: ["chest" as const], frequency: 10 },
      { name: "b", muscles: ["biceps" as const], frequency: 20 },
      { name: "c", muscles: ["triceps" as const], frequency: 40 },
    ]
    const out = bucketBodyMapFrequencies(data, 5)
    expect(out.find((r) => r.muscles[0] === "chest")!.frequency).toBe(1)
    expect(out.find((r) => r.muscles[0] === "biceps")!.frequency).toBe(2)
    expect(out.find((r) => r.muscles[0] === "triceps")!.frequency).toBe(5)
  })

  it("uses middle bucket when all positive frequencies are equal", () => {
    const data = [
      { name: "a", muscles: ["chest" as const], frequency: 5 },
      { name: "b", muscles: ["biceps" as const], frequency: 5 },
    ]
    const out = bucketBodyMapFrequencies(data, 7)
    expect(out.every((r) => r.frequency === 4)).toBe(true)
  })

  it("keeps zero frequency and middle-buckets a lone positive value", () => {
    const data = [
      { name: "a", muscles: ["chest" as const], frequency: 0 },
      { name: "b", muscles: ["biceps" as const], frequency: 8 },
    ]
    const out = bucketBodyMapFrequencies(data, 5)
    expect(out[0].frequency).toBe(0)
    expect(out[1].frequency).toBe(3)
  })
})
