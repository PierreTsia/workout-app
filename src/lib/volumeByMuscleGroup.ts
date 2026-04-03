import type { SupabaseClient } from "@supabase/supabase-js"
import {
  BODY_MAP_VOLUME_BUCKET_COUNT,
  bucketBodyMapFrequencies,
  buildBodyMapData,
} from "@/lib/muscleMapping"

export interface VolumeByMuscleRow {
  muscle_group: string
  total_sets: number
  total_volume_kg: number
  exercise_count: number
}

export interface VolumeByMuscleResult {
  finished_sessions: number
  muscles: VolumeByMuscleRow[]
}

export async function fetchVolumeByMuscleGroup(
  client: SupabaseClient,
  userId: string,
  days: number,
  offsetDays: number,
): Promise<VolumeByMuscleResult> {
  const { data, error } = await client.rpc("get_volume_by_muscle_group", {
    p_user_id: userId,
    p_days: days,
    p_offset_days: offsetDays,
  })

  if (error) throw error

  const raw = data as unknown as VolumeByMuscleResult | null
  if (!raw || !Array.isArray(raw.muscles)) {
    return { finished_sessions: 0, muscles: [] }
  }

  return {
    finished_sessions: Number(raw.finished_sessions) || 0,
    muscles: raw.muscles.map((m) => ({
      muscle_group: String(m.muscle_group),
      total_sets: Number(m.total_sets) || 0,
      total_volume_kg: Number(m.total_volume_kg) || 0,
      exercise_count: Number(m.exercise_count) || 0,
    })),
  }
}

export function hasEnoughBalanceData(result: VolumeByMuscleResult): boolean {
  if (result.finished_sessions < 3) return false
  const totalSets = result.muscles.reduce((s, m) => s + m.total_sets, 0)
  return totalSets > 0
}

export function muscleRowsToBodyMapExercises(
  muscles: readonly VolumeByMuscleRow[],
) {
  return muscles.map((m) => ({
    name: m.muscle_group,
    muscleGroup: m.muscle_group,
    sets: Math.max(0, m.total_sets),
  }))
}

export function bodyMapDataFromMuscleVolume(muscles: readonly VolumeByMuscleRow[]) {
  const raw = buildBodyMapData(muscleRowsToBodyMapExercises(muscles))
  return bucketBodyMapFrequencies(raw, BODY_MAP_VOLUME_BUCKET_COUNT)
}
