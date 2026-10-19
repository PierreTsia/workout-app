import { useEffect } from "react"
import { useAtomValue } from "jotai"
import { sessionAtom } from "@/store/atoms"

export function useSessionOrientationGuard(): void {
  const session = useAtomValue(sessionAtom)
  const active = session.isActive && session.startedAt != null

  useEffect(() => {
    if (!active) return

    try {
      void screen.orientation?.lock?.("portrait")?.catch(() => {})
    } catch {
      // lock threw synchronously — silent fallback
    }

    return () => {
      try {
        screen.orientation?.unlock?.()
      } catch {
        // unlock unsupported — silent fallback
      }
    }
  }, [active])
}
