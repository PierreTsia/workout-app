import { useEffect, useRef, useState } from "react"
import { useAtom } from "jotai"
import { useTranslation } from "react-i18next"
import { restAtom } from "@/store/atoms"
import { Button } from "@/components/ui/button"

const CIRCLE_RADIUS = 90
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS

function formatSeconds(s: number): string {
  const mins = Math.floor(s / 60)
  const secs = s % 60
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
}

let audioCtx: AudioContext | null = null
function getAudioCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext()
  return audioCtx
}

function playBeep(frequency: number, durationMs: number, volume = 0.3) {
  try {
    const ctx = getAudioCtx()
    if (ctx.state === "suspended") ctx.resume()

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.frequency.value = frequency
    osc.type = "sine"
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000)

    osc.start()
    osc.stop(ctx.currentTime + durationMs / 1000)
  } catch {
    // Web Audio not available — silent fallback
  }
}

function playWarningBeep() {
  playBeep(660, 150, 0.2)
}

function playFinishBeeps() {
  playBeep(880, 200, 0.5)
  setTimeout(() => playBeep(1100, 300, 0.5), 250)
}

export function RestTimerOverlay() {
  const { t } = useTranslation("workout")
  const [rest, setRest] = useAtom(restAtom)
  const [remaining, setRemaining] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const hasNotifiedRef = useRef(false)
  const hasWarned10sRef = useRef(false)

  useEffect(() => {
    if (!rest) {
      hasNotifiedRef.current = false
      hasWarned10sRef.current = false
      return
    }

    function tick() {
      const elapsedSec = (Date.now() - rest!.startedAt) / 1000
      const left = Math.max(0, Math.ceil(rest!.durationSeconds - elapsedSec))
      setRemaining(left)
      setElapsed(elapsedSec)

      if (left <= 10 && left > 0 && !hasWarned10sRef.current) {
        hasWarned10sRef.current = true
        playWarningBeep()
      }

      if (left <= 0 && !hasNotifiedRef.current) {
        hasNotifiedRef.current = true
        playFinishBeeps()

        if (navigator.vibrate) {
          navigator.vibrate([200, 100, 200])
        }
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification(t("restOverNotif"), { body: t("restOverBody") })
        }

        setTimeout(() => setRest(null), 1200)
      }
    }

    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [rest, setRest, t])

  if (!rest) return null

  const progress = rest.durationSeconds > 0
    ? Math.min(1, elapsed / rest.durationSeconds)
    : 1
  const dashOffset = CIRCLE_CIRCUMFERENCE * (1 - progress)

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-background/95 backdrop-blur-sm">
      <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
        {t("rest")}
      </p>

      <div className="relative flex items-center justify-center">
        <svg width="220" height="220" className="-rotate-90">
          <circle
            cx="110"
            cy="110"
            r={CIRCLE_RADIUS}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="8"
          />
          <circle
            cx="110"
            cy="110"
            r={CIRCLE_RADIUS}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={CIRCLE_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            className="transition-[stroke-dashoffset] duration-300 ease-linear"
          />
        </svg>
        <span className="absolute font-mono text-5xl font-bold tabular-nums">
          {formatSeconds(remaining)}
        </span>
      </div>

      <Button
        variant="outline"
        size="lg"
        onClick={() => setRest(null)}
        className="min-w-[140px]"
      >
        {t("skip")}
      </Button>
    </div>
  )
}
