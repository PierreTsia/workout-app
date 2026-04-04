import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { drainQueue } from "@/lib/syncService"
import { authAtom } from "@/store/atoms"

interface SaveAsProgramInput {
  dayId: string
  programName: string
}

export function useSaveAsProgram() {
  const user = useAtomValue(authAtom)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ dayId, programName }: SaveAsProgramInput) => {
      if (!user) throw new Error("Not authenticated")

      const { data: program, error: progError } = await supabase
        .from("programs")
        .insert({
          user_id: user.id,
          name: programName,
          is_active: false,
          is_quick: true,
        })
        .select("id")
        .single()
      if (progError) throw progError

      const { error: dayError } = await supabase
        .from("workout_days")
        .update({ program_id: program.id })
        .eq("id", dayId)
      if (dayError) throw dayError

      return { programId: program.id }
    },
    onSuccess: async (data) => {
      if (!user) return
      // Library uses useUserPrograms → ["user-programs", id]; old ["programs"] matched nothing.
      qc.invalidateQueries({ queryKey: ["user-programs"] })
      qc.invalidateQueries({
        queryKey: ["workout-days", user.id, data.programId],
      })
      // Finish + save can overlap: first drain may still be running; wait so history reflects DB.
      await drainQueue(user.id)
      qc.invalidateQueries({ queryKey: ["sessions"] })
      qc.invalidateQueries({ queryKey: ["sessions-date-range"] })
    },
  })
}
