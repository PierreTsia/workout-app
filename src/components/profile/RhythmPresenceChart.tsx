import { useTranslation } from "react-i18next"
import { MIX_CATEGORIES, type ProfileWindowKind } from "@/lib/profile/window"
import { cn } from "@/lib/utils"

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const
const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const

const GRID_COLS: Record<ProfileWindowKind, string> = {
  "7": "grid-cols-7",
  "30": "grid-cols-5",
  "100": "grid-cols-4",
  "365": "grid-cols-4",
  all: "grid-cols-3",
}

function periodLabels(
  kind: ProfileWindowKind,
  translate: (key: string, options?: { n: number }) => string,
): readonly string[] {
  if (kind === "7") {
    return WEEKDAYS.map((day) => translate(`rhythm.weekday.${day}`))
  }
  if (kind === "30" || kind === "100") {
    return MIX_CATEGORIES[kind].map((_, i) => translate("rhythm.week", { n: i + 1 }))
  }
  if (kind === "365") {
    return MONTHS.map((month) => translate(`rhythm.month.${month}`))
  }
  return MIX_CATEGORIES.all
}

export function RhythmPresenceChart({
  kind,
  presence,
}: {
  kind: ProfileWindowKind
  presence: readonly boolean[]
}) {
  const { t } = useTranslation("profile")
  const labels = periodLabels(kind, (key, options) => t(key, options))
  const cells = labels.map((label, i) => ({
    label,
    on: presence[i] === true,
  }))

  return (
    <ol
      aria-label={t("rhythm.title")}
      className={cn("grid justify-items-center gap-x-2 gap-y-3", GRID_COLS[kind])}
    >
      {cells.map((cell) => {
        const status = cell.on ? t("rhythm.session") : t("rhythm.none")
        return (
          <li
            key={cell.label}
            aria-label={`${cell.label}, ${status}`}
            className="flex min-w-0 flex-col items-center gap-1"
          >
            <span
              aria-hidden="true"
              className={
                cell.on
                  ? "size-5 rounded-full bg-primary"
                  : "size-5 rounded-full border border-border bg-transparent"
              }
            />
            <span className="max-w-full truncate text-[10px] leading-none text-muted-foreground">
              {cell.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
