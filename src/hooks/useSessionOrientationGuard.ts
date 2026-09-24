import { useEffect } from "react"
import { useAtomValue } from "jotai"
import { sessionAtom } from "@/store/atoms"

const GUARD_CLASS = "gl-session-orientation-guard"

type RotValue = "-90" | "90"

function currentRot(): RotValue {
  const angle =
    screen.orientation?.angle ??
    ("orientation" in window && typeof window.orientation === "number"
      ? window.orientation
      : undefined)
  if (angle === undefined || Number.isNaN(angle)) return "-90"
  return angle > 0 && angle < 180 ? "-90" : "90"
}

export function useSessionOrientationGuard(): void {
  const session = useAtomValue(sessionAtom)
  const active = session.isActive && session.startedAt != null

  useEffect(() => {
    const root = document.documentElement
    if (!active) return

    root.classList.add(GUARD_CLASS)
    root.setAttribute("data-gl-rot", currentRot())

    try {
      void screen.orientation?.lock?.("portrait")?.catch(() => {})
    } catch {
      // lock threw synchronously — silent fallback
    }

    const updateRot = () => root.setAttribute("data-gl-rot", currentRot())
    screen.orientation?.addEventListener?.("change", updateRot)
    window.addEventListener("orientationchange", updateRot)

    return () => {
      screen.orientation?.removeEventListener?.("change", updateRot)
      window.removeEventListener("orientationchange", updateRot)
      root.classList.remove(GUARD_CLASS)
      root.removeAttribute("data-gl-rot")
      try {
        screen.orientation?.unlock?.()
      } catch {
        // unlock unsupported — silent fallback
      }
    }
  }, [active])
}
