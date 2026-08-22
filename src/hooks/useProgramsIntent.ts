import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { SLIM_EXERCISE_SELECT } from "@/lib/exerciseSelects"
import {
  PROGRAM_INTENT_KEY,
  PROGRAMS_INTENT_KEY,
} from "@/lib/programScore/queryKeys"
import { scoreProgram } from "@/lib/programScore/scoreProgram"
import { toIntent } from "@/lib/programScore/toIntent"
import type { ProgramScore, SlimDayRow } from "@/lib/programScore/types"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"

export type ProgramsIntentMap = Readonly<Record<string, ProgramScore>>

type IntentDayRow = SlimDayRow & { program_id: string }

const EXERCISE_EMBED = `exercise:exercises(${SLIM_EXERCISE_SELECT})`

export const PROGRAMS_INTENT_SELECT = [
  "id",
  "label",
  "sort_order",
  "program_id",
  `workout_exercises(sets, rest_seconds, reps, rep_range_min, rep_range_max, muscle_snapshot, ${EXERCISE_EMBED})`,
  `exercise_blocks(mode, cap_seconds, rounds, exercises:block_exercises(muscle_snapshot, ${EXERCISE_EMBED}))`,
].join(", ")

function scoreByProgram(
  programIds: readonly string[],
  rows: readonly IntentDayRow[],
): ProgramsIntentMap {
  const daysByProgram = rows.reduce<Readonly<Record<string, IntentDayRow[]>>>(
    (acc, row) => ({
      ...acc,
      [row.program_id]: [...(acc[row.program_id] ?? []), row],
    }),
    Object.fromEntries(programIds.map((id) => [id, []])),
  )

  return Object.fromEntries(
    programIds.map((id) => [
      id,
      scoreProgram(toIntent(id, daysByProgram[id] ?? [])),
    ]),
  )
}

export function useProgramsIntent(programIds: readonly string[]) {
  const user = useAtomValue(authAtom)
  const queryClient = useQueryClient()
  const idsKey = [...programIds].sort().join(",")

  return useQuery({
    queryKey: [PROGRAMS_INTENT_KEY, user?.id, idsKey],
    enabled: user != null && programIds.length > 0,
    queryFn: async (): Promise<ProgramsIntentMap> => {
      const { data, error } = await supabase
        .from("workout_days")
        .select(PROGRAMS_INTENT_SELECT)
        .in("program_id", [...programIds])
        .order("sort_order")
        .returns<IntentDayRow[]>()

      if (error) throw error

      const scores = scoreByProgram(programIds, data ?? [])
      programIds.forEach((id) => {
        queryClient.setQueryData([PROGRAM_INTENT_KEY, id], scores[id])
      })
      return scores
    },
  })
}
