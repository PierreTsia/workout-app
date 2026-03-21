import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import {
  parseExerciseHistorySheetPayload,
  type ExerciseHistorySessionRow,
} from "@/lib/exerciseHistorySheet"

export function useExerciseSessionHistorySheet(
  open: boolean,
  exerciseId: string | undefined,
) {
  const user = useAtomValue(authAtom)
  const isOnline = useOnlineStatus()

  return useQuery<ExerciseHistorySessionRow[]>({
    queryKey: ["exercise-session-history", exerciseId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_exercise_history_for_sheet", {
        p_exercise_id: exerciseId,
        p_session_limit: 5,
      })
      if (error) throw error
      return parseExerciseHistorySheetPayload(data)
    },
    enabled: Boolean(open && exerciseId && isOnline && user),
    staleTime: 15_000,
  })
}
