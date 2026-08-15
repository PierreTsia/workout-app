import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { CountdownRing } from "@/components/workout/CountdownRing"
import { useCountdown } from "@/hooks/useCountdown"

/** 3, 2, 1, then a one-second GO beat. */
const GO_STEPS_SECONDS = 4

interface BlockGoCountdownProps {
  onComplete: () => void
}

/** Map useCountdown ticks (4…1) onto the 3-2-1-GO beat the athlete sees. */
function goBeat(remaining: number | null): { ring: number; label: string | null } {
  const ticks = remaining ?? GO_STEPS_SECONDS
  if (ticks <= 1) return { ring: 0, label: null }
  return { ring: ticks - 1, label: String(ticks - 1) }
}

export function BlockGoCountdown({ onComplete }: BlockGoCountdownProps) {
  const { t } = useTranslation("workout")
  const { remaining, start } = useCountdown(onComplete)

  useEffect(() => {
    start(GO_STEPS_SECONDS)
  }, [start])

  const beat = goBeat(remaining)
  const label = beat.label ?? t("blockRunner.go")

  return (
    <div
      role="region"
      aria-label={t("blockRunner.goTitle")}
      className="flex flex-1 flex-col items-center justify-center"
    >
      <CountdownRing remaining={beat.ring} total={3}>
        <span aria-live="assertive">{label}</span>
      </CountdownRing>
    </div>
  )
}
