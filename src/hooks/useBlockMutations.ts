import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import { buildBlockInsertRows } from "@/lib/blockPersistence"
import { resizePerRound } from "@/lib/perRound"
import type { PerRoundCell, ExerciseListItem } from "@/types/database"

interface CreateBlockInput {
  dayId: string
  libraryExercises: ExerciseListItem[]
  /** Highest existing sort_order in the day across solos and blocks; -1 if empty. */
  existingMaxSortOrder: number
}

/**
 * Creates an Exercise Block (#351): inserts the `exercise_blocks` row, then its
 * `block_exercises` with the returned `block_id`. Per-round prescriptions are
 * seeded from catalog defaults (see `buildBlockInsertRows`).
 */
export function useCreateBlock() {
  const user = useAtomValue(authAtom)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      dayId,
      libraryExercises,
      existingMaxSortOrder,
    }: CreateBlockInput) => {
      if (!user) throw new Error("Not authenticated")

      const { block, blockExercises } = buildBlockInsertRows({
        dayId,
        libraryExercises,
        existingMaxSortOrder,
      })

      const { data: created, error: blockError } = await supabase
        .from("exercise_blocks")
        .insert(block)
        .select("id")
        .single()
      if (blockError) throw blockError

      const rows = blockExercises.map((be) => ({
        ...be,
        block_id: created.id,
      }))
      const { error: exError } = await supabase
        .from("block_exercises")
        .insert(rows)
      if (exError) throw exError

      return { blockId: created.id }
    },
    onSuccess: (_data, { dayId }) => {
      qc.invalidateQueries({ queryKey: ["exercise-blocks", dayId] })
      qc.invalidateQueries({ queryKey: ["workout-days"] })
    },
  })
}

interface UpdateBlockMetaInput {
  blockId: string
  dayId: string
  label?: string | null
  rounds?: number
  rest_seconds?: number
  transition_seconds?: number
  mode?: "rounds" | "amrap"
  cap_seconds?: number | null
  /** Current per_round of each block exercise; required when `rounds` changes so they can be resized in lockstep. */
  exercises?: { id: string; per_round: PerRoundCell[] }[]
}

/**
 * Updates an Exercise Block's scalar settings (#351, T139). When `rounds`
 * changes, every block exercise's `per_round` is resized in the same write so
 * the `per_round.length === rounds` invariant holds.
 */
export function useUpdateBlockMeta() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      blockId,
      label,
      rounds,
      rest_seconds,
      transition_seconds,
      mode,
      cap_seconds,
      exercises,
    }: UpdateBlockMetaInput) => {
      const isAmrap = mode === "amrap"
      const blockPatch = isAmrap
        ? {
            ...(label !== undefined && { label }),
            mode: "amrap" as const,
            rounds: 1,
            rest_seconds: 0,
            transition_seconds: 0,
            ...(cap_seconds !== undefined && { cap_seconds }),
          }
        : {
            ...(label !== undefined && { label }),
            ...(rounds !== undefined && { rounds }),
            ...(rest_seconds !== undefined && { rest_seconds }),
            ...(transition_seconds !== undefined && { transition_seconds }),
            ...(mode !== undefined && { mode }),
            ...(cap_seconds !== undefined && { cap_seconds }),
          }
      if (Object.keys(blockPatch).length > 0) {
        const { error } = await supabase
          .from("exercise_blocks")
          .update(blockPatch)
          .eq("id", blockId)
        if (error) throw error
      }

      if (!exercises) return

      const nextPerRound =
        mode === "amrap"
          ? (cells: PerRoundCell[]) => cells.slice(0, 1)
          : rounds !== undefined
            ? (cells: PerRoundCell[]) => resizePerRound(cells, rounds)
            : null
      if (!nextPerRound) return

      const results = await Promise.all(
        exercises.map((ex) =>
          supabase
            .from("block_exercises")
            .update({ per_round: nextPerRound(ex.per_round) })
            .eq("id", ex.id),
        ),
      )
      const failed = results.find((r) => r.error)
      if (failed?.error) throw failed.error
    },
    onSuccess: (_data, { dayId }) => {
      qc.invalidateQueries({ queryKey: ["exercise-blocks", dayId] })
    },
  })
}

/** Persists a single block exercise's per-round prescription (#351, T139). */
export function useUpdatePerRound() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      blockExerciseId,
      perRound,
    }: {
      blockExerciseId: string
      dayId: string
      perRound: PerRoundCell[]
    }) => {
      const { error } = await supabase
        .from("block_exercises")
        .update({ per_round: perRound })
        .eq("id", blockExerciseId)
      if (error) throw error
    },
    onSuccess: (_data, { dayId }) => {
      qc.invalidateQueries({ queryKey: ["exercise-blocks", dayId] })
    },
  })
}

/** Deletes a block (cascades to its block_exercises) (#351). */
export function useDeleteBlock() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      blockId,
    }: {
      blockId: string
      dayId: string
    }) => {
      const { error } = await supabase
        .from("exercise_blocks")
        .delete()
        .eq("id", blockId)
      if (error) throw error
    },
    onSuccess: (_data, { dayId }) => {
      qc.invalidateQueries({ queryKey: ["exercise-blocks", dayId] })
      qc.invalidateQueries({ queryKey: ["workout-days"] })
    },
  })
}

/**
 * Persists new `sort_order` values for blocks after a unified day reorder
 * (#351, T140). Mirrors `useReorderExercises` for the block half.
 */
export function useReorderBlocks() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      blocks,
    }: {
      dayId: string
      blocks: { id: string; sort_order: number }[]
    }) => {
      const results = await Promise.all(
        blocks.map((b) =>
          supabase
            .from("exercise_blocks")
            .update({ sort_order: b.sort_order })
            .eq("id", b.id),
        ),
      )
      const failed = results.find((r) => r.error)
      if (failed?.error) throw failed.error
    },
    onSuccess: (_data, { dayId }) => {
      qc.invalidateQueries({ queryKey: ["exercise-blocks", dayId] })
    },
  })
}
