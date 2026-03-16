import { useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useAtom } from "jotai"
import { useTranslation } from "react-i18next"
import { Zap } from "lucide-react"
import { sessionAtom, isQuickWorkoutAtom } from "@/store/atoms"
import { QuickWorkoutSheet } from "@/components/generator/QuickWorkoutSheet"
import { Button } from "@/components/ui/button"

export function QuickWorkoutTab() {
  const { t } = useTranslation("generator")
  const navigate = useNavigate()
  const [session, setSession] = useAtom(sessionAtom)
  const [, setIsQuickWorkout] = useAtom(isQuickWorkoutAtom)
  const [sheetOpen, setSheetOpen] = useState(false)

  const handleStart = useCallback(
    (dayId: string) => {
      setSession((prev) => ({
        ...prev,
        currentDayId: dayId,
        exerciseIndex: 0,
        setsData: {},
        totalSetsDone: 0,
        isActive: true,
        activeDayId: dayId,
        startedAt: Date.now(),
        pausedAt: null,
        accumulatedPause: 0,
      }))
      setIsQuickWorkout(true)
      navigate("/")
    },
    [setSession, setIsQuickWorkout, navigate],
  )

  if (session.isActive) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Zap className="h-6 w-6 text-primary" />
        </div>
        <p className="text-sm text-muted-foreground">{t("quickWorkoutDesc")}</p>
        <Button variant="outline" onClick={() => navigate("/")}>
          {t("startWorkout")}
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Zap className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">{t("quickWorkout")}</h2>
        <p className="max-w-xs text-sm text-muted-foreground">{t("quickWorkoutDesc")}</p>
        <Button onClick={() => setSheetOpen(true)} className="gap-2">
          <Zap className="h-4 w-4" />
          {t("generate")}
        </Button>
      </div>

      <QuickWorkoutSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onStart={handleStart}
      />
    </>
  )
}
