import { useTranslation } from "react-i18next"
import { RhythmBarChart } from "@/components/profile/charts/RhythmBarChart"
import { MIX_CATEGORIES, type ProfileWindowKind } from "@/lib/profile/window"
import { cn } from "@/lib/utils"

function usesFrequencyBars(kind: ProfileWindowKind): boolean {
  return kind === "365" || kind === "all"
}

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

const DEFAULT_TARGET = 4

function clusterSlots(kind: ProfileWindowKind, target: number): number {
  return kind === "7" ? 1 : target
}

function clusterLabel(
  kind: ProfileWindowKind,
  index: number,
  count: number,
  translate: (key: string, options?: { n: number }) => string,
): string {
  if (kind === "7") {
    const day = WEEKDAYS[index]
    return day === undefined ? "" : translate(`rhythm.weekday.${day}`)
  }
  if (kind === "365") {
    const month = MONTHS[index]
    return month === undefined ? "" : translate(`rhythm.month.${month}`)
  }
  if (kind === "all") {
    return MIX_CATEGORIES.all[index] ?? ""
  }
  const ago = count - 1 - index
  return ago === 0
    ? translate("rhythm.weekCurrent")
    : translate("rhythm.weekAgo", { n: ago })
}

export function RhythmPresenceChart({
  kind,
  hits,
  target = DEFAULT_TARGET,
  deloadAt,
}: {
  kind: ProfileWindowKind
  hits: readonly number[]
  target?: number
  deloadAt?: number
}) {
  const { t } = useTranslation("profile")
  const labels = hits.map((_, i) =>
    clusterLabel(kind, i, hits.length, (key, options) => t(key, options)),
  )

  if (usesFrequencyBars(kind)) {
    return (
      <RhythmBarChart categories={labels} series={hits} target={target} />
    )
  }

  const slots = clusterSlots(kind, target)
  const clusters = hits.map((hit, i) => {
    const filled = Math.min(Math.max(hit, 0), slots)
    return {
      label: labels[i] ?? "",
      filled,
      slots,
      deload: i === deloadAt,
    }
  })

  return (
    <ol
      aria-label={t("rhythm.title")}
      className="flex w-full justify-between gap-1 overflow-x-auto"
    >
      {clusters.map((cluster) => {
        const status = t("rhythm.hits", {
          filled: cluster.filled,
          slots: cluster.slots,
        })
        const dots = Array.from({ length: cluster.slots }, (_, i) => i < cluster.filled)
        return (
          <li
            key={cluster.label}
            aria-label={`${cluster.label}, ${status}`}
            className="flex min-w-0 flex-col items-center gap-1"
          >
            <span className="flex gap-px" aria-hidden="true">
              {dots.map((on, i) => (
                <span
                  key={i}
                  data-rhythm-dot={on ? "on" : "off"}
                  className={cn(
                    "shrink-0 rounded-full",
                    kind === "7" ? "size-2.5" : "size-1.5 sm:size-2",
                    on ? "bg-primary" : "bg-muted-foreground/30",
                  )}
                />
              ))}
            </span>
            <span className="max-w-full truncate text-[10px] leading-none text-muted-foreground">
              {cluster.label}
            </span>
            {cluster.deload ? (
              <span className="max-w-20 text-center text-[9px] leading-tight text-muted-foreground">
                {t("rhythm.deload", { week: cluster.label, n: cluster.filled })}
              </span>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
