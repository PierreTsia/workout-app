import { useAtomValue } from "jotai"
import { useTranslation } from "react-i18next"
import { UserRound } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useBadgeStatus } from "@/hooks/useBadgeStatus"
import { useUserProfile } from "@/hooks/useUserProfile"
import { authAtom } from "@/store/atoms"
import { resolveAvatarUrl, resolveDisplayName } from "@/lib/userDisplay"
import { cn } from "@/lib/utils"
import { rankColorText, resolveActiveTitle } from "@/lib/achievementUtils"

export function ProfileHeader() {
  const { t, i18n } = useTranslation("achievements")
  const user = useAtomValue(authAtom)
  const { data: profile } = useUserProfile()
  const { data: rows = [] } = useBadgeStatus()

  const unlockedCount = rows.filter((r) => r.is_unlocked).length
  const totalCount = rows.length

  const activeTitle = resolveActiveTitle(profile, rows)

  const avatarSrc = user && profile ? resolveAvatarUrl(user, profile) : undefined
  const displayName = resolveDisplayName(user, profile)

  return (
    <section className="flex flex-col items-center gap-2 py-2">
      <Avatar className="h-20 w-20 border-2 border-border">
        <AvatarImage src={avatarSrc} alt="" referrerPolicy="no-referrer" />
        <AvatarFallback>
          <UserRound className="h-8 w-8 text-muted-foreground" />
        </AvatarFallback>
      </Avatar>

      <h2 className="text-lg font-bold">{displayName}</h2>

      {activeTitle ? (
        <p
          className={cn(
            "text-sm font-semibold italic",
            rankColorText[activeTitle.rank],
          )}
        >
          {i18n.language === "fr" ? activeTitle.title_fr : activeTitle.title_en}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground/50 italic">
          {t("noTitle")}
        </p>
      )}

      {totalCount > 0 && (
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {t("unlockedCount", { count: unlockedCount, total: totalCount })}
        </span>
      )}
    </section>
  )
}
