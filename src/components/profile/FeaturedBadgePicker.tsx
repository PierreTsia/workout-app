import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useAtomValue } from "jotai"
import { Check, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useBadgeStatus } from "@/hooks/useBadgeStatus"
import { useEquipTitle } from "@/hooks/useEquipTitle"
import { rankColorText, sortWonBadgesByRankDesc } from "@/lib/achievementUtils"
import { cn } from "@/lib/utils"
import { authAtom } from "@/store/atoms"
import type { BadgeStatusRow } from "@/types/achievements"

function badgeTitle(badge: BadgeStatusRow, language: string): string {
  return language === "fr" ? badge.title_fr : badge.title_en
}

export function FeaturedBadgePicker({
  title,
  equipped,
}: {
  title: string
  equipped: BadgeStatusRow
}) {
  const { t, i18n } = useTranslation("profile")
  const user = useAtomValue(authAtom)
  const { data: badges } = useBadgeStatus()
  const equipTitle = useEquipTitle()
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<{
    fromTierId: string
    badge: BadgeStatusRow
  } | null>(null)

  const won = sortWonBadgesByRankDesc(badges ?? [])
  const shown =
    picked != null && picked.fromTierId === equipped.tier_id
      ? picked.badge
      : equipped
  const shownTitle =
    shown.tier_id === equipped.tier_id ? title : badgeTitle(shown, i18n.language)
  const canEdit = user != null && won.length > 0

  const titleLine = (
    <p
      className={cn(
        "text-sm font-semibold italic",
        rankColorText[shown.rank],
      )}
    >
      {shownTitle}
    </p>
  )

  function handlePick(badge: BadgeStatusRow) {
    if (badge.tier_id === shown.tier_id) {
      setOpen(false)
      return
    }
    setPicked({ fromTierId: equipped.tier_id, badge })
    setOpen(false)
    equipTitle.mutate(badge.tier_id, {
      onError: () => {
        setPicked((current) =>
          current?.badge.tier_id === badge.tier_id ? null : current,
        )
      },
    })
  }

  if (!canEdit) return titleLine

  return (
    <div className="flex items-center gap-0.5">
      {titleLine}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 text-muted-foreground"
            aria-label={t("hero.changeFeaturedBadge")}
          >
            <Pencil className="size-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-1">
          <ScrollArea className="max-h-64">
            <ul
              role="listbox"
              aria-label={t("hero.featuredBadgeList")}
              className="flex flex-col"
            >
              {won.map((badge) => {
                const selected = badge.tier_id === shown.tier_id
                return (
                  <li key={badge.tier_id}>
                    <Button
                      type="button"
                      variant="ghost"
                      role="option"
                      aria-selected={selected}
                      className={cn(
                        "h-auto w-full justify-start px-2 py-1.5 font-medium",
                        rankColorText[badge.rank],
                      )}
                      onClick={() => handlePick(badge)}
                    >
                      <span className="min-w-0 flex-1 truncate text-left">
                        {badgeTitle(badge, i18n.language)}
                      </span>
                      {selected ? <Check className="size-3.5 shrink-0" /> : null}
                    </Button>
                  </li>
                )
              })}
            </ul>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  )
}
