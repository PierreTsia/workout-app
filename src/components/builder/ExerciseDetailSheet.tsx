import { useTranslation } from "react-i18next"
import type { WorkoutExerciseWithExercise } from "@/types/database"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import { useExerciseFromLibrary } from "@/hooks/useExerciseFromLibrary"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ExerciseDetailForm } from "./ExerciseDetailForm"

interface ExerciseDetailSheetProps {
  exercise: WorkoutExerciseWithExercise
  open: boolean
  onOpenChange: (open: boolean) => void
  onMutationStateChange: (state: "saving" | "saved" | "error") => void
}

export function ExerciseDetailSheet({
  exercise,
  open,
  onOpenChange,
  onMutationStateChange,
}: ExerciseDetailSheetProps) {
  const { t } = useTranslation("builder")
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const { unit } = useWeightUnit()
  const { data: libExercise, isLoading: libLoading } = useExerciseFromLibrary(
    exercise.exercise_id,
  )

  const form =
    !libLoading ? (
      <ExerciseDetailForm
        key={`${exercise.id}:${unit}`}
        exercise={exercise}
        libExercise={libExercise}
        onMutationStateChange={onMutationStateChange}
      />
    ) : null

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto p-0 sm:max-w-md">
          <DialogHeader className="sr-only">
            <DialogTitle>{t("editDetails")}</DialogTitle>
            <DialogDescription>{t("editDetails")}</DialogDescription>
          </DialogHeader>
          {form}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[90vh] overflow-y-auto p-0"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{t("editDetails")}</SheetTitle>
          <SheetDescription>{t("editDetails")}</SheetDescription>
        </SheetHeader>
        {form}
      </SheetContent>
    </Sheet>
  )
}
