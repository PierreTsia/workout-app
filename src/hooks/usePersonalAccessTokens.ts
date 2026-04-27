import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import type { PersonalAccessToken } from "@/types/personalAccessToken"

const PAT_LIST_COLUMNS =
  "id, user_id, name, prefix, expires_at, last_used_at, created_at"

export const personalAccessTokensQueryKey = (userId: string | undefined) =>
  ["personal-access-tokens", userId] as const

export function usePersonalAccessTokens() {
  const user = useAtomValue(authAtom)

  return useQuery<PersonalAccessToken[]>({
    queryKey: personalAccessTokensQueryKey(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personal_access_tokens")
        .select(PAT_LIST_COLUMNS)
        .order("created_at", { ascending: false })

      if (error) throw error
      return (data ?? []) as PersonalAccessToken[]
    },
    enabled: !!user,
    staleTime: 1000 * 30,
  })
}
