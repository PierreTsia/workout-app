import { useCallback, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { Button } from "@/components/ui/button"
import { OfflineBlock } from "@/components/builder/OfflineBlock"
import { SaveIndicator } from "@/components/builder/SaveIndicator"
import { DayList } from "@/components/builder/DayList"
import { DayEditor } from "@/components/builder/DayEditor"
import { ExerciseDetailEditor } from "@/components/builder/ExerciseDetailEditor"

type BuilderView = "list" | "editor" | "detail"
type SaveStatus = "idle" | "saving" | "saved" | "error"

export function BuilderPage() {
  const { t } = useTranslation("builder")
  const navigate = useNavigate()
  const isOnline = useOnlineStatus()

  const [view, setView] = useState<BuilderView>("list")
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null)
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(
    null,
  )
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")

  const handleMutationState = useCallback(
    (state: "saving" | "saved" | "error") => {
      setSaveStatus(state)
    },
    [],
  )

  function handleBack() {
    if (view === "detail") {
      setSelectedExerciseId(null)
      setView("editor")
    } else if (view === "editor") {
      setSelectedDayId(null)
      setView("list")
    } else {
      navigate("/")
    }
  }

  function handleSelectDay(dayId: string) {
    setSelectedDayId(dayId)
    setView("editor")
  }

  function handleSelectExercise(exerciseId: string) {
    setSelectedExerciseId(exerciseId)
    setView("detail")
  }

  const viewTitle =
    view === "list"
      ? t("workoutBuilder")
      : view === "editor"
        ? t("editDay")
        : t("editExercise")

  if (!isOnline) {
    return (
      <div className="flex flex-1 flex-col">
        <header className="flex items-center gap-3 border-b px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold">{t("workoutBuilder")}</h1>
        </header>
        <OfflineBlock />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="flex-1 text-lg font-bold">{viewTitle}</h1>
        <SaveIndicator status={saveStatus} />
      </header>

      <div className="flex-1 overflow-y-auto">
        {view === "list" && (
          <DayList
            onSelectDay={handleSelectDay}
            onMutationStateChange={handleMutationState}
          />
        )}

        {view === "editor" && selectedDayId && (
          <DayEditor
            dayId={selectedDayId}
            onSelectExercise={handleSelectExercise}
            onMutationStateChange={handleMutationState}
          />
        )}

        {view === "detail" && selectedDayId && selectedExerciseId && (
          <ExerciseDetailEditor
            dayId={selectedDayId}
            exerciseId={selectedExerciseId}
            onMutationStateChange={handleMutationState}
          />
        )}
      </div>
    </div>
  )
}
