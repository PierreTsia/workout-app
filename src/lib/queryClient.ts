import { MutationCache, QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import i18n from "@/lib/i18n"

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.options.meta?.suppressGlobalErrorToast) return

      if (import.meta.env.DEV) {
        console.error("[Mutation error]", error)
      }

      toast.error(i18n.t("error:mutationError", { defaultValue: i18n.t("error:title") }))
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
})
