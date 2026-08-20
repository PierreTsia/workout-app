import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"

export function useEquipTitle() {
  const user = useAtomValue(authAtom)
  const queryClient = useQueryClient()
  const { t } = useTranslation("achievements")

  return useMutation({
    mutationFn: async (tierId: string | null) => {
      if (!user) throw new Error("Not authenticated")
      const { error } = await supabase
        .from("user_profiles")
        .update({ active_title_tier_id: tierId })
        .eq("user_id", user.id)
      if (error) throw error
    },
    onSuccess: (_, tierId) => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ["user-profile", user.id] })
      }
      toast.success(tierId ? t("titleEquipped") : t("titleRemoved"))
    },
    onError: () => {
      toast.error(t("titleError"))
    },
  })
}
