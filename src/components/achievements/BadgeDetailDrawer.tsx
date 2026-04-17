import { useAtomValue } from "jotai"
import { useTranslation } from "react-i18next"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { BadgeIcon } from "./BadgeIcon"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import { useUserProfile } from "@/hooks/useUserProfile"
import { cn } from "@/lib/utils"
import { rankColorText } from "@/lib/achievementUtils"
import type { BadgeStatusRow } from "@/types/achievements"

interface BadgeDetailDrawerProps {
  badge: BadgeStatusRow | null
  onClose: () => void
}

export function BadgeDetailDrawer({ badge, onClose }: BadgeDetailDrawerProps) {
  const { t, i18n } = useTranslation("achievements")
  const user = useAtomValue(authAtom)
  const queryClient = useQueryClient()
  const { data: profile } = useUserProfile()

  const isActive = profile?.active_title_tier_id === badge?.tier_id

  const equipTitle = useMutation({
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

  if (!badge) return null

  const title = i18n.language === "fr" ? badge.title_fr : badge.title_en
  const groupName =
    i18n.language === "fr" ? badge.group_name_fr : badge.group_name_en

  const unlockedDate = badge.granted_at
    ? new Date(badge.granted_at).toLocaleDateString(i18n.language, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null

  const remaining = Math.max(
    0,
    Math.ceil(badge.threshold_value - badge.current_value),
  )

  return (
    <Drawer open={!!badge} onOpenChange={(open) => { if (!open) onClose() }}>
      <DrawerContent>
        <DrawerHeader className="flex flex-col items-center gap-3 pb-2">
          <BadgeIcon
            rank={badge.rank}
            iconUrl={badge.icon_asset_url}
            size="lg"
            locked={!badge.is_unlocked}
            alt={title}
          />
          <DrawerTitle className="text-xl">{title}</DrawerTitle>
          <DrawerDescription className="sr-only">
            {groupName} — {badge.rank}
          </DrawerDescription>

          <span
            className={cn(
              "rounded-full px-3 py-0.5 text-sm font-semibold capitalize",
              rankColorText[badge.rank],
              "bg-muted",
            )}
          >
            {t(`ranks.${badge.rank}`)}
          </span>

          <p className="text-sm text-muted-foreground">{groupName}</p>
          <p className="max-w-xs text-center text-xs text-muted-foreground/70">
            {t(`groupDescriptions.${badge.group_slug}`)}
          </p>
        </DrawerHeader>

        <div className="flex flex-col items-center gap-4 px-6 pb-8">
          <p className="text-sm font-medium text-foreground/80">
            {t(`thresholdHint.${badge.group_slug}`, {
              target: Math.floor(badge.threshold_value),
            })}
          </p>

          {badge.is_unlocked && unlockedDate ? (
            <p className="text-sm text-muted-foreground">
              {t("unlockedOn", { date: unlockedDate })}
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {t("moreToGo", { count: remaining })}
              </p>
              <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, badge.progress_pct)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t("progress", {
                  current: Math.floor(badge.current_value),
                  target: Math.floor(badge.threshold_value),
                })}
              </p>
            </>
          )}

          {badge.is_unlocked && (
            <Button
              variant={isActive ? "outline" : "default"}
              size="lg"
              className="w-full max-w-xs"
              disabled={equipTitle.isPending}
              onClick={() =>
                equipTitle.mutate(isActive ? null : badge.tier_id)
              }
            >
              {isActive ? t("unequipTitle") : t("equipTitle")}
            </Button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
