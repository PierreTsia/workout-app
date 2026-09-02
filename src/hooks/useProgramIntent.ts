import { useQuery } from "@tanstack/react-query"
import { PROGRAMS_INTENT_SELECT } from "@/hooks/useProgramsIntent"
import {
  programIntentPayload,
  type ProgramIntentPayload,
} from "@/lib/programScore/hypertrophyExample"
import { PROGRAM_INTENT_KEY } from "@/lib/programScore/queryKeys"
import { toIntent } from "@/lib/programScore/toIntent"
import type { SlimDayRow } from "@/lib/programScore/types"
import { supabase } from "@/lib/supabase"

export function useProgramIntent(programId: string | null) {
  return useQuery({
    queryKey: [PROGRAM_INTENT_KEY, programId],
    enabled: programId != null,
    queryFn: async (): Promise<ProgramIntentPayload> => {
      const { data, error } = await supabase
        .from("workout_days")
        .select(PROGRAMS_INTENT_SELECT)
        .eq("program_id", programId!)
        .order("sort_order")
        .returns<SlimDayRow[]>()

      if (error) throw error
      return programIntentPayload(toIntent(programId!, data ?? []))
    },
  })
}
