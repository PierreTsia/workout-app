import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { useTranslation } from "react-i18next"
import { supabase } from "@/lib/supabase"
import {
  parseCircuitLedgerPayload,
  type CircuitLedgerRun,
} from "@/lib/profile/circuitLedger"
import { authAtom } from "@/store/atoms"

export function useProfileCircuitLedger() {
  const user = useAtomValue(authAtom)
  const { i18n } = useTranslation()
  const language = i18n.language
  return useQuery<CircuitLedgerRun[]>({
    queryKey: ["profile-circuit-ledger", user?.id, language],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_profile_circuit_ledger")
      if (error) throw error
      return parseCircuitLedgerPayload(data, language)
    },
    enabled: Boolean(user),
  })
}
