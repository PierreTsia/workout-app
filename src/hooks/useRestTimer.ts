import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { useAtom } from "jotai"
import { useTranslation } from "react-i18next"
import { restAtom, type RestState } from "@/store/atoms"

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

export function formatSeconds(s: number): string {
  const mins = Math.floor(s / 60)
  const secs = s % 60
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
}

function getEffectiveElapsed(rest: RestState, now: number): number {
  const accPause = rest.accumulatedPause ?? 0
  if (rest.pausedAt != null) {
    return rest.pausedAt - rest.startedAt - accPause
  }
  return now - rest.startedAt - accPause
}

function computeTimerState(rest: RestState | null, now: number) {
  if (!rest) return { remaining: 0, progress: 0 }
  const elapsedMs = getEffectiveElapsed(rest, now)
  const elapsedSec = elapsedMs / 1000
  const remaining = Math.max(0, Math.ceil(rest.durationSeconds - elapsedSec))
  const progress = rest.durationSeconds > 0
    ? Math.min(1, elapsedSec / rest.durationSeconds)
    : 1
  return { remaining, progress }
}

export function useRestTimer() {
  const { t } = useTranslation("workout")
  const [rest, setRest] = useAtom(restAtom)
  const [now, setNow] = useState(Date.now)
  const hasNotifiedRef = useRef(false)
  const hasWarned10sRef = useRef(false)
  const lastStartedAtRef = useRef<number | null>(null)

  const isPaused = rest?.pausedAt != null
  const isActive = rest != null

  const { remaining, progress } = useMemo(
    () => computeTimerState(rest, now),
    [rest, now],
  )

  useEffect(() => {
    if (!rest) {
      hasNotifiedRef.current = false
      hasWarned10sRef.current = false
      lastStartedAtRef.current = null
      return
    }

    if (rest.startedAt !== lastStartedAtRef.current) {
      hasNotifiedRef.current = false
      hasWarned10sRef.current = false
      lastStartedAtRef.current = rest.startedAt
    }

    function tick() {
      setNow(Date.now())

      const state = computeTimerState(rest, Date.now())

      if (state.remaining <= 10 && state.remaining > 0 && !hasWarned10sRef.current) {
        hasWarned10sRef.current = true
        playWarningBeep()
      }

      if (state.remaining <= 0 && !hasNotifiedRef.current) {
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
    if (!isPaused) {
      const id = setInterval(tick, 250)
      return () => clearInterval(id)
    }
  }, [rest, setRest, t, isPaused])

  const pause = useCallback(() => {
    setRest((prev) => {
      if (!prev || prev.pausedAt != null) return prev
      return { ...prev, pausedAt: Date.now() }
    })
  }, [setRest])

  const resume = useCallback(() => {
    setRest((prev) => {
      if (!prev || prev.pausedAt == null) return prev
      const pauseDuration = Date.now() - prev.pausedAt
      return {
        ...prev,
        pausedAt: null,
        accumulatedPause: (prev.accumulatedPause ?? 0) + pauseDuration,
      }
    })
  }, [setRest])

  const skip = useCallback(() => {
    setRest(null)
  }, [setRest])

  const togglePause = useCallback(() => {
    if (isPaused) {
      resume()
    } else {
      pause()
    }
  }, [isPaused, pause, resume])

  return {
    isActive,
    isPaused,
    remaining,
    progress,
    pause,
    resume,
    skip,
    togglePause,
    formatted: formatSeconds(remaining),
  }
}
