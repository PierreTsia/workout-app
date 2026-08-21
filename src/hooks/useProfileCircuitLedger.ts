import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import {
  parseCircuitLedgerPayload,
  type CircuitLedgerRun,
} from "@/lib/profile/circuitLedger"
import { authAtom } from "@/store/atoms"

export function useProfileCircuitLedger() {
  const user = useAtomValue(authAtom)
  return useQuery<CircuitLedgerRun[]>({
    queryKey: ["profile-circuit-ledger", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_profile_circuit_ledger")
      if (error) throw error
      return parseCircuitLedgerPayload(data)
    },
    enabled: Boolean(user),
  })
}
