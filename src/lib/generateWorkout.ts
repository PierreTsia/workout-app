import type { Exercise } from "@/types/database"
import { groupBy } from "@/lib/utils"
import type {
  GeneratorConstraints,
  GeneratedWorkout,
  GeneratedExercise,
} from "@/types/generator"
import {
  VOLUME_MAP,
  MAJOR_MUSCLE_GROUPS,
  COMPOUND_REPS,
  COMPOUND_REST_SECONDS,
  ISOLATION_REPS,
  ISOLATION_REST_SECONDS,
} from "./generatorConfig"
import {
  formatEquipmentLabelForName,
  getEquipmentValuesForCategories,
  isBodyweightOnlySelection,
} from "./equipmentSelection"

function isCompound(exercise: Exercise): boolean {
  return (exercise.secondary_muscles?.length ?? 0) > 0
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function pickWithVariety(pool: Exercise[], count: number): Exercise[] {
  if (pool.length <= count) return shuffleArray(pool)

  const shuffled = shuffleArray(pool)
  const picked: Exercise[] = []
  const remaining = [...shuffled]

  while (picked.length < count && remaining.length > 0) {
    const lastGroup = picked.at(-1)?.muscle_group
    const preferredIdx = remaining.findIndex(
      (e) => e.muscle_group !== lastGroup,
    )
    const idx = preferredIdx >= 0 ? preferredIdx : 0
    picked.push(remaining.splice(idx, 1)[0])
  }

  return picked
}

function pickDistributed(
  pool: Exercise[],
  targetCount: number,
  groups: readonly string[],
): Exercise[] {
  const byGroup = groupBy(pool, (ex) => ex.muscle_group)

  const availableGroups = groups.filter((g) => byGroup.has(g))
  if (availableGroups.length === 0) return pickWithVariety(pool, targetCount)

  const perGroup = Math.max(1, Math.floor(targetCount / availableGroups.length))
  const remainder = targetCount - perGroup * availableGroups.length

  const picked = availableGroups.flatMap((group, i) => {
    const groupPool = shuffleArray(byGroup.get(group) ?? [])
    const take = perGroup + (i < remainder ? 1 : 0)
    return groupPool.slice(0, take)
  })

  if (picked.length < targetCount) {
    const pickedIds = new Set(picked.map((e) => e.id))
    const leftover = pool.filter((e) => !pickedIds.has(e.id))
    picked.push(
      ...shuffleArray(leftover).slice(0, targetCount - picked.length),
    )
  }

  return shuffleArray(picked)
}

export function buildExercise(
  exercise: Exercise,
  setsPerExercise: number,
): GeneratedExercise {
  const compound = isCompound(exercise)
  return {
    exercise,
    sets: setsPerExercise,
    reps: compound ? COMPOUND_REPS : ISOLATION_REPS,
    restSeconds: compound ? COMPOUND_REST_SECONDS : ISOLATION_REST_SECONDS,
    isCompound: compound,
  }
}

function isFullBody(groups: string[]): boolean {
  return groups.length === 0 || groups.includes("full-body")
}

export function generateWorkout(
  exercises: Exercise[],
  constraints: GeneratorConstraints,
): GeneratedWorkout {
  const { duration, equipmentCategories, muscleGroups } = constraints
  const equipmentValues = getEquipmentValuesForCategories(equipmentCategories)
  const { exerciseCount, setsPerExercise } = VOLUME_MAP[duration]
  const fullBody = isFullBody(muscleGroups)

  let pool = exercises.filter((e) => equipmentValues.includes(e.equipment))

  if (!fullBody) {
    pool = pool.filter((e) => muscleGroups.includes(e.muscle_group))
  }

  let hasFallback = false

  if (pool.length < exerciseCount && !isBodyweightOnlySelection(equipmentCategories)) {
    const widened = exercises.filter(
      (e) =>
        [...equipmentValues, "bodyweight"].includes(e.equipment) &&
        (fullBody || muscleGroups.includes(e.muscle_group)),
    )
    if (widened.length > pool.length) {
      pool = widened
      hasFallback = true
    }
  }

  if (pool.length === 0) {
    return {
      exercises: [],
      name: buildName(constraints),
      hasFallback: false,
    }
  }

  const useDistribution = fullBody || muscleGroups.length > 1
  const distributionGroups = fullBody
    ? MAJOR_MUSCLE_GROUPS
    : muscleGroups

  const selected = useDistribution
    ? pickDistributed(pool, exerciseCount, distributionGroups)
    : pickWithVariety(pool, exerciseCount)

  return {
    exercises: selected.map((e) => buildExercise(e, setsPerExercise)),
    name: buildName(constraints),
    hasFallback,
  }
}

function buildName(constraints: GeneratorConstraints): string {
  const fullBody = isFullBody(constraints.muscleGroups)
  const focus = fullBody
    ? "Full Body"
    : constraints.muscleGroups.join(" + ")
  const equip = formatEquipmentLabelForName(constraints.equipmentCategories)
  return `Quick: ${focus} / ${equip} / ${constraints.duration}min`
}
