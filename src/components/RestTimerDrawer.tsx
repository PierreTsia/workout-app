import { Pause, Play, SkipForward } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { useRestTimer } from "@/hooks/useRestTimer"

const CIRCLE_RADIUS = 90
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS

interface RestTimerDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RestTimerDrawer({ open, onOpenChange }: RestTimerDrawerProps) {
  const { t } = useTranslation("workout")
  const { isPaused, progress, formatted, togglePause, skip } = useRestTimer()

  const dashOffset = CIRCLE_CIRCUMFERENCE * (1 - progress)

  function handleSkip() {
    skip()
    onOpenChange(false)
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-center uppercase tracking-widest text-muted-foreground text-sm font-medium">
            {t("rest")}
          </DrawerTitle>
        </DrawerHeader>

        <div className="flex flex-col items-center gap-6 px-4 pb-4">
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
            <span className={`absolute font-mono text-5xl font-bold tabular-nums ${isPaused ? "animate-pulse text-muted-foreground" : ""}`}>
              {formatted}
            </span>
          </div>
        </div>

        <DrawerFooter className="flex-row justify-center gap-4">
          <Button
            variant="outline"
            size="lg"
            onClick={togglePause}
            className="min-w-[120px] gap-2"
          >
            {isPaused ? (
              <>
                <Play className="h-4 w-4" />
                {t("resume")}
              </>
            ) : (
              <>
                <Pause className="h-4 w-4" />
                {t("pause")}
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={handleSkip}
            className="min-w-[120px] gap-2"
          >
            <SkipForward className="h-4 w-4" />
            {t("skip")}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
