import { useState } from "react"
import { Hourglass } from "lucide-react"
import { useRestTimer } from "@/hooks/useRestTimer"
import { RestTimerDrawer } from "@/components/RestTimerDrawer"
import { Button } from "@/components/ui/button"

export function RestTimerPill() {
  const { isActive, isPaused, formatted } = useRestTimer()
  const [drawerOpen, setDrawerOpen] = useState(false)

  if (!isActive) return null

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setDrawerOpen(true)}
        className={`h-auto gap-1.5 rounded-full border-primary/30 bg-primary/10 px-3 py-1 hover:bg-primary/20 ${isPaused ? "animate-pulse" : ""}`}
        aria-label="Open rest timer"
      >
        <Hourglass className="h-3.5 w-3.5 text-primary" />
        <span className="font-mono text-sm font-semibold tabular-nums text-primary">
          {formatted}
        </span>
      </Button>

      <RestTimerDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  )
}
