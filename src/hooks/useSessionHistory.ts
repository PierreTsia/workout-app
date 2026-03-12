import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import type { Session } from "@/types/database"

export function useSessionHistory() {
  const user = useAtomValue(authAtom)

  return useQuery<Session[]>({
    queryKey: ["sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .not("finished_at", "is", null)
        .order("started_at", { ascending: false })

      if (error) throw error
      return (data as Session[]) ?? []
    },
    enabled: !!user,
  })
}
