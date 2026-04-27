import { useTranslation } from "react-i18next"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/formatters"
import { formatRelativeTime } from "@/lib/formatRelativeTime"
import type { PersonalAccessToken } from "@/types/personalAccessToken"

interface PATListItemProps {
  token: PersonalAccessToken
  onRevoke: (token: PersonalAccessToken) => void
}

function isExpired(expires_at: string | null): boolean {
  if (!expires_at) return false
  return new Date(expires_at).getTime() <= Date.now()
}

export function PATListItem({ token, onRevoke }: PATListItemProps) {
  const { t, i18n } = useTranslation("api-tokens")
  const locale = i18n.language

  const expired = isExpired(token.expires_at)

  const expiryLabel = !token.expires_at
    ? t("expiresNever")
    : expired
      ? t("expired")
      : t("expiresIn", {
          relative: formatRelativeTime(token.expires_at, locale),
        })

  const lastUsedLabel = token.last_used_at
    ? t("lastUsed", {
        relative: formatRelativeTime(token.last_used_at, locale),
      })
    : t("neverUsed")

  return (
    <li
      className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card/50 p-3"
      data-testid="pat-list-item"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {token.name}
          </span>
          {expired ? (
            <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
              {t("expired")}
            </span>
          ) : null}
        </div>
        <code className="font-mono text-xs text-muted-foreground">
          {token.prefix}…
        </code>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            {t("createdAt", {
              date: formatDate(token.created_at, locale, {
                dateStyle: "medium",
              }),
            })}
          </span>
          <span aria-hidden="true">·</span>
          <span>{expiryLabel}</span>
          <span aria-hidden="true">·</span>
          <span>{lastUsedLabel}</span>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-destructive"
        onClick={() => onRevoke(token)}
        aria-label={t("revokeAria", { name: token.name })}
      >
        <Trash2 className="h-4 w-4" />
        <span className="sr-only sm:not-sr-only sm:ml-1.5">{t("revoke")}</span>
      </Button>
    </li>
  )
}
