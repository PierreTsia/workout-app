import { useCallback, useState } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Dumbbell, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { useProgram } from "@/hooks/useProgram"
import { Button } from "@/components/ui/button"
import { OfflineBlock } from "@/components/builder/OfflineBlock"
import { BuilderHeader } from "@/components/builder/BuilderHeader"
import { DayList } from "@/components/builder/DayList"
import { DayEditor } from "@/components/builder/DayEditor"
import { ExerciseDetailEditor } from "@/components/builder/ExerciseDetailEditor"

type BuilderView = "list" | "editor" | "detail"
type SaveStatus = "idle" | "saving" | "saved" | "error"

export function BuilderPage() {
  const { t } = useTranslation("builder")
  const { programId } = useParams<{ programId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const isOnline = useOnlineStatus()

  const {
    data: program,
    isLoading: programLoading,
    isError: programError,
  } = useProgram(programId ?? null)

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

  function navigateBack() {
    const from = (location.state as { from?: string } | null)?.from
    navigate(from ?? "/library/programs")
  }

  function handleBack() {
    if (view === "detail") {
      setSelectedExerciseId(null)
      setView("editor")
    } else if (view === "editor") {
      setSelectedDayId(null)
      setView("list")
    } else {
      navigateBack()
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
          <Button variant="ghost" size="icon" onClick={navigateBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold">{t("workoutBuilder")}</h1>
        </header>
        <OfflineBlock />
      </div>
    )
  }

  if (programLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!programId || programError || !program) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <Dumbbell className="h-16 w-16 text-muted-foreground/50" />
        <h2 className="text-xl font-bold">{t("invalidProgram")}</h2>
        <Button asChild>
          <Link to="/library/programs">{t("goToLibrary")}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
      <BuilderHeader
        programId={programId}
        saveStatus={saveStatus}
        viewTitle={viewTitle}
        onBack={handleBack}
      />

      <div className="flex-1 overflow-y-auto">
        {view === "list" && (
          <DayList
            programId={programId}
            onSelectDay={handleSelectDay}
            onMutationStateChange={handleMutationState}
          />
        )}

        {view === "editor" && selectedDayId && (
          <DayEditor
            programId={programId}
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
