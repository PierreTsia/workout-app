import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import {
  buildBlockMetaMap,
  type BlockExerciseMetaRow,
  type BlockMeta,
} from "@/lib/sessionHistoryGrouping"

/**
 * Resolves the block metadata (parent block label/order, exercise position +
 * emoji) for a set of `block_exercise_id`s found on a session's `set_logs`, so
 * History can render circuits as grouped cards (#351, T143). Deleted blocks
 * simply don't resolve → their logs fall back to a flat solo display.
 */
export function useSessionBlockMeta(blockExerciseIds: string[]) {
  const ids = [...new Set(blockExerciseIds)].sort()

  return useQuery<Map<string, BlockMeta>>({
    queryKey: ["session-block-meta", ids],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("block_exercises")
        .select(
          "id, block_id, emoji_snapshot, position, block:exercise_blocks(id, label, rounds, sort_order)",
        )
        .in("id", ids)

      if (error) throw error
      return buildBlockMetaMap((data ?? []) as unknown as BlockExerciseMetaRow[])
    },
    enabled: ids.length > 0,
  })
}
