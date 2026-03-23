import { useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer"
import { ConstraintStep } from "./ConstraintStep"
import { PreviewStep } from "./PreviewStep"
import { useExercisesForGenerator } from "@/hooks/useExercisesForGenerator"
import { useCreateQuickWorkout } from "@/hooks/useCreateQuickWorkout"
import {
  useAIGenerateWorkout,
  isNetworkError,
  isQuotaError,
} from "@/hooks/useAIGenerateWorkout"
import { generateWorkout } from "@/lib/generateWorkout"
import type { GeneratorConstraints, GeneratedWorkout } from "@/types/generator"

type Step = "constraints" | "preview"

interface QuickWorkoutSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onStart: (dayId: string) => void
}

const DEFAULT_CONSTRAINTS: GeneratorConstraints = {
  duration: 30,
  equipmentCategories: ["full-gym"],
  muscleGroups: ["full-body"],
}

export function QuickWorkoutSheet({
  open,
  onOpenChange,
  onStart,
}: QuickWorkoutSheetProps) {
  const { t } = useTranslation("generator")
  const [step, setStep] = useState<Step>("constraints")
  const [constraints, setConstraints] =
    useState<GeneratorConstraints>(DEFAULT_CONSTRAINTS)
  const [generatedWorkout, setGeneratedWorkout] =
    useState<GeneratedWorkout | null>(null)
  const [previewKey, setPreviewKey] = useState(0)

  const { data: exercisePool = [], isLoading: isLoadingExercises } =
    useExercisesForGenerator(
      constraints.muscleGroups,
      constraints.equipmentCategories,
    )

  const createQuickWorkout = useCreateQuickWorkout()
  const aiGenerate = useAIGenerateWorkout({ exercisePool })

  const handleAIGenerate = useCallback(() => {
    aiGenerate.mutate(constraints, {
      onSuccess: (result) => {
        setGeneratedWorkout(result)
        setPreviewKey((k) => k + 1)
        setStep("preview")
      },
      onError: (err) => {
        if (isQuotaError(err)) {
          toast.error(t("errorQuota"))
        } else if (isNetworkError(err)) {
          toast.error(t("networkError"))
        } else {
          toast.error(t("aiError"))
        }
      },
    })
  }, [aiGenerate, constraints, t])

  const handleGenerate = useCallback(() => {
    const result = generateWorkout(exercisePool, constraints)
    setGeneratedWorkout(result)
    setPreviewKey((k) => k + 1)
    setStep("preview")
  }, [exercisePool, constraints])

  const handleShuffle = useCallback(() => {
    const result = generateWorkout(exercisePool, constraints)
    setGeneratedWorkout(result)
    setPreviewKey((k) => k + 1)
  }, [exercisePool, constraints])

  const handleStart = useCallback(
    (workout: GeneratedWorkout) => {
      createQuickWorkout.mutate(workout, {
        onSuccess: ({ dayId }) => {
          onStart(dayId)
          onOpenChange(false)
          setStep("constraints")
          setGeneratedWorkout(null)
        },
      })
    },
    [createQuickWorkout, onStart, onOpenChange],
  )

  const handleBack = useCallback(() => {
    setStep("constraints")
  }, [])

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setStep("constraints")
      setGeneratedWorkout(null)
    }
    onOpenChange(nextOpen)
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="max-h-[90dvh]">
        <DrawerHeader>
          <DrawerTitle>{t("quickWorkout")}</DrawerTitle>
          <DrawerDescription>{t("quickWorkoutDesc")}</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto">
          {step === "constraints" && (
            <ConstraintStep
              constraints={constraints}
              onChange={setConstraints}
              onGenerate={handleGenerate}
              onAIGenerate={handleAIGenerate}
              isLoading={isLoadingExercises}
              isAILoading={aiGenerate.isPending}
            />
          )}
          {step === "preview" && generatedWorkout && (
            <PreviewStep
              key={previewKey}
              workout={generatedWorkout}
              exercisePool={exercisePool}
              onStart={handleStart}
              onShuffle={handleShuffle}
              onBack={handleBack}
              isStarting={createQuickWorkout.isPending}
            />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
