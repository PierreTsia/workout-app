import { useEffect, useRef } from "react"

export function useKeepScreenAwake(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!active) return
    if (typeof navigator === "undefined" || !navigator.wakeLock) return

    let cancelled = false

    async function acquire() {
      try {
        const sentinel = await navigator.wakeLock.request("screen")
        if (cancelled) {
          void sentinel.release()
          return
        }
        sentinel.addEventListener("release", () => {
          sentinelRef.current = null
        })
        sentinelRef.current = sentinel
      } catch {
        // wake lock denied / unsupported — silent fallback
      }
    }

    function handleVisibility() {
      if (
        document.visibilityState === "visible" &&
        !sentinelRef.current
      ) {
        void acquire()
      }
    }

    void acquire()
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", handleVisibility)
      if (sentinelRef.current) {
        void sentinelRef.current.release()
        sentinelRef.current = null
      }
    }
  }, [active])
}
