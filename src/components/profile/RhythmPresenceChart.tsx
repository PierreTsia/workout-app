import { useTranslation } from "react-i18next"
import { RhythmHeatmap } from "@/components/profile/RhythmHeatmap"
import { type ProfileWindowKind } from "@/lib/profile/window"
import {
  encodeRhythmGoalDays,
  pierreRhythmSessionDays,
  PROFILE_RHYTHM_END,
  rhythmHeatmapRangeDays,
} from "@/lib/profile/rhythmHeatmap"
import { cn } from "@/lib/utils"

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const

const DEFAULT_TARGET = 4

function clusterSlots(kind: ProfileWindowKind, target: number, hit: number): number {
  if (kind === "7") return 1
  return Math.max(target, Math.max(hit, 0))
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
  const heatmapDays = rhythmHeatmapRangeDays(kind)

  if (heatmapDays != null) {
    return (
      <RhythmHeatmap
        data={encodeRhythmGoalDays(pierreRhythmSessionDays(kind), target)}
        rangeDays={heatmapDays}
        endDate={PROFILE_RHYTHM_END}
        target={target}
      />
    )
  }

  const labels = hits.map((_, i) =>
    clusterLabel(kind, i, hits.length, (key, options) => t(key, options)),
  )

  const clusters = hits.map((hit, i) => {
    const filled = Math.max(hit, 0)
    const slots = clusterSlots(kind, target, filled)
    return {
      label: labels[i] ?? "",
      filled: Math.min(filled, slots),
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
          slots: target,
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
                    kind === "7" ? "size-2.5" : "size-2 sm:size-2.5",
                    on
                      ? i >= target
                        ? "bg-primary ring-1 ring-primary/40"
                        : "bg-primary"
                      : "bg-muted-foreground/30",
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
