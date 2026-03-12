import { Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useExerciseLibrary } from "@/hooks/useExerciseLibrary"
import { useAddExerciseToDay } from "@/hooks/useBuilderMutations"
import type { Exercise } from "@/types/database"
import { ExerciseInfoDialog } from "@/components/exercise/ExerciseInfoDialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"

interface ExerciseLibraryPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dayId: string
  existingExerciseCount: number
  onMutationStateChange: (state: "saving" | "saved" | "error") => void
}

export function ExerciseLibraryPicker({
  open,
  onOpenChange,
  dayId,
  existingExerciseCount,
  onMutationStateChange,
}: ExerciseLibraryPickerProps) {
  const { t } = useTranslation("builder")
  const { data: exercises, isLoading } = useExerciseLibrary()
  const addExercise = useAddExerciseToDay()

  function handleSelect(exercise: Exercise) {
    onMutationStateChange("saving")
    addExercise.mutate(
      { dayId, exercise, sortOrder: existingExerciseCount },
      {
        onSuccess: () => {
          onMutationStateChange("saved")
          onOpenChange(false)
        },
        onError: () => onMutationStateChange("error"),
      },
    )
  }

  const grouped = exercises?.reduce<Record<string, Exercise[]>>((acc, ex) => {
    const group = ex.muscle_group
    if (!acc[group]) acc[group] = []
    acc[group].push(ex)
    return acc
  }, {})

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] flex-col gap-0 p-0">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>{t("addExercise")}</DialogTitle>
        </DialogHeader>

        <Command className="flex-1">
          <CommandInput placeholder={t("searchExercises")} />
          <CommandList className="max-h-[60vh]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <CommandEmpty>{t("noExercisesFound")}</CommandEmpty>
                {grouped &&
                  Object.entries(grouped).map(([muscle, exList]) => (
                    <CommandGroup key={muscle} heading={muscle}>
                      {exList.map((ex) => (
                        <CommandItem
                          key={ex.id}
                          value={`${ex.name} ${ex.muscle_group}`}
                          onSelect={() => handleSelect(ex)}
                          disabled={addExercise.isPending}
                          className="flex items-center justify-between"
                        >
                          <span className="flex items-center">
                            <span className="mr-2 text-base">{ex.emoji}</span>
                            <span>{ex.name}</span>
                          </span>
                          <ExerciseInfoDialog exercise={ex} />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))}
              </>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
