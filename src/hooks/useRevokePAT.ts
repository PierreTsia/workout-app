import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import { personalAccessTokensQueryKey } from "@/hooks/usePersonalAccessTokens"

/**
 * Hard delete by id. RLS (`auth.uid() = user_id`) guarantees the caller can
 * only delete their own rows, so we don't filter by `user_id` client-side.
 *
 * Optimistic update is intentional: the row disappears from the list
 * immediately while the network call settles. On error we roll back and let
 * the global mutation toast surface the failure.
 */
export function useRevokePAT() {
  const user = useAtomValue(authAtom)
  const queryClient = useQueryClient()
  const queryKey = personalAccessTokensQueryKey(user?.id)

  return useMutation<void, Error, string, { previous: unknown }>({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("personal_access_tokens")
        .delete()
        .eq("id", id)

      if (error) throw error
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)
      queryClient.setQueryData(queryKey, (old: unknown) => {
        if (!Array.isArray(old)) return old
        return old.filter((row) => (row as { id: string }).id !== id)
      })
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })
}
