import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { SLIM_EXERCISE_SELECT } from "@/lib/exerciseSelects"
import { programIntentPayload } from "@/lib/programScore/hypertrophyExample"
import {
  PROGRAM_INTENT_KEY,
  PROGRAMS_INTENT_KEY,
} from "@/lib/programScore/queryKeys"
import {
  bodyMapFromIntent,
  type ProgramBodyMap,
} from "@/lib/programScore/bodyMapFromIntent"
import { outlineDaysFromRows } from "@/lib/programScore/dayOutline"
import { scoreProgram } from "@/lib/programScore/scoreProgram"
import { toIntent } from "@/lib/programScore/toIntent"
import type {
  ProgramDayOutline,
  ProgramScore,
  SlimDayRow,
} from "@/lib/programScore/types"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"

export type ProgramIntentView = {
  score: ProgramScore
  bodyMap: ProgramBodyMap
  days: readonly ProgramDayOutline[]
}

export type ProgramsIntentMap = Readonly<Record<string, ProgramIntentView>>

type IntentDayRow = SlimDayRow & { program_id: string }

const EXERCISE_EMBED = `exercise:exercises(${SLIM_EXERCISE_SELECT})`

export const PROGRAMS_INTENT_SELECT = [
  "id",
  "label",
  "emoji",
  "sort_order",
  "program_id",
  `workout_exercises(id, name_snapshot, emoji_snapshot, sort_order, sets, rest_seconds, reps, rep_range_min, rep_range_max, muscle_snapshot, ${EXERCISE_EMBED})`,
  `exercise_blocks(id, label, mode, cap_seconds, rounds, sort_order, exercises:block_exercises(id, position, muscle_snapshot, ${EXERCISE_EMBED}))`,
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
    programIds.map((id) => {
      const programRows = daysByProgram[id] ?? []
      const intent = toIntent(id, programRows)
      return [
        id,
        {
          score: scoreProgram(intent),
          bodyMap: bodyMapFromIntent(intent),
          days: outlineDaysFromRows(programRows),
        },
      ]
    }),
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
        const programRows = (data ?? []).filter((row) => row.program_id === id)
        queryClient.setQueryData(
          [PROGRAM_INTENT_KEY, id],
          programIntentPayload(toIntent(id, programRows)),
        )
      })
      return scores
    },
  })
}
