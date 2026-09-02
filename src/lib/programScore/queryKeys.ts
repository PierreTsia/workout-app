import type { QueryClient } from "@tanstack/react-query"

export const PROGRAMS_INTENT_KEY = "programs-intent"
export const PROGRAM_INTENT_KEY = "program-intent"

export function invalidateProgramIntentQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: [PROGRAMS_INTENT_KEY] })
  queryClient.invalidateQueries({ queryKey: [PROGRAM_INTENT_KEY] })
}
