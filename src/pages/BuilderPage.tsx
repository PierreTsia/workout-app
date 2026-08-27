import { useCallback, useState } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Dumbbell } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { useProgram } from "@/hooks/useProgram"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { OfflineBlock } from "@/components/builder/OfflineBlock"
import { BuilderHeader } from "@/components/builder/BuilderHeader"
import { DayList } from "@/components/builder/DayList"
import { DayListSkeleton } from "@/components/builder/DayListSkeleton"
import { DayEditor } from "@/components/builder/DayEditor"
import { DayEditorSkeleton } from "@/components/builder/DayEditorSkeleton"
import { ExerciseDetailEditor } from "@/components/builder/ExerciseDetailEditor"
import { readBuilderLocationState } from "@/lib/builderLocationState"

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

  const nav = readBuilderLocationState(location.state)
  const [view, setView] = useState<BuilderView>(nav.dayId ? "editor" : "list")
  const [selectedDayId, setSelectedDayId] = useState<string | null>(
    nav.dayId ?? null,
  )
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
    const { from } = readBuilderLocationState(location.state)
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
      <div className="flex flex-1 flex-col">
        <div
          className="flex items-center gap-3 border-b px-4 py-3"
          aria-hidden
        >
          <Skeleton className="h-9 w-9 shrink-0" />
          <Skeleton className="h-5 w-40" />
        </div>
        {nav.dayId ? <DayEditorSkeleton /> : <DayListSkeleton />}
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
    <div className="flex flex-1 flex-col">
      <BuilderHeader
        programId={programId}
        saveStatus={saveStatus}
        viewTitle={viewTitle}
        onBack={handleBack}
      />

      <div className="flex-1 overflow-y-auto scrollbar-thin">
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
