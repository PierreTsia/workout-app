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
import { QuickWorkoutAIGeneratingStep } from "./QuickWorkoutAIGeneratingStep"
import { useExercisesForGenerator } from "@/hooks/useExercisesForGenerator"
import { useCreateQuickWorkout } from "@/hooks/useCreateQuickWorkout"
import { useCommitQuickWorkout } from "@/hooks/useCommitQuickWorkout"
import { generateWorkout } from "@/lib/generateWorkout"
import type { GeneratorConstraints, GeneratedWorkout } from "@/types/generator"

type Step = "constraints" | "ai-generating" | "preview"

/**
 * Tracks which generator produced the current preview so the terminal
 * action (Start / Save) routes to the right persistence path.
 *
 *  - "ai" + Start → `commit-quick-workout` Edge fn → MCP create_workout_day
 *    (T128). Single canonical write surface for ad-hoc days, shared with
 *    external MCP clients.
 *  - "deterministic" + Start → `useCreateQuickWorkout` (raw insert).
 *    Pre-existing path, kept verbatim because there's no reason to round-
 *    trip a server when the prescription was built client-side.
 *  - Save (draft, either source) → `useCreateQuickWorkout`. The MCP tool
 *    has no `saved_at` semantics today, so drafts stay on the legacy hook
 *    until the data model gets a real draft concept.
 */
type GenerationSource = "ai" | "deterministic"

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
  const [generationSource, setGenerationSource] =
    useState<GenerationSource>("deterministic")
  const [previewKey, setPreviewKey] = useState(0)

  const { data: exercisePool = [], isLoading: isLoadingExercises } =
    useExercisesForGenerator(
      constraints.muscleGroups,
      constraints.equipmentCategories,
    )

  const createQuickWorkout = useCreateQuickWorkout()
  const commitQuickWorkout = useCommitQuickWorkout()

  const handleStartAIGeneration = useCallback(() => {
    setStep("ai-generating")
  }, [])

  const handleAISuccess = useCallback((result: GeneratedWorkout) => {
    setGeneratedWorkout(result)
    setGenerationSource("ai")
    setPreviewKey((k) => k + 1)
    setStep("preview")
  }, [])

  const handleFallbackQuickGenerate = useCallback(
    (workout: GeneratedWorkout) => {
      // AI Generate hit a network/quota error and fell back to the
      // deterministic generator — same as if the user had clicked
      // Quick Generate directly. Source tracks the *actual* producer
      // so the commit path matches the data we have.
      setGeneratedWorkout(workout)
      setGenerationSource("deterministic")
      setPreviewKey((k) => k + 1)
      setStep("preview")
    },
    [],
  )

  const handleGenerate = useCallback(() => {
    const result = generateWorkout(exercisePool, constraints)
    setGeneratedWorkout(result)
    setGenerationSource("deterministic")
    setPreviewKey((k) => k + 1)
    setStep("preview")
  }, [exercisePool, constraints])

  const handleShuffle = useCallback(() => {
    // Shuffle re-rolls deterministically regardless of how the original
    // preview was produced. The previously rendered AI rationale gets
    // dropped (already done at PreviewStep), and the new payload is
    // strictly deterministic-source.
    const result = generateWorkout(exercisePool, constraints)
    setGeneratedWorkout(result)
    setGenerationSource("deterministic")
    setPreviewKey((k) => k + 1)
  }, [exercisePool, constraints])

  const handleStart = useCallback(
    (workout: GeneratedWorkout) => {
      // Routing decision (T128): AI-source goes through the canonical
      // MCP write path (single source of truth shared with external
      // clients); deterministic-source stays on the raw insert because
      // there's no reason to round-trip a server for client-side data.
      if (generationSource === "ai") {
        commitQuickWorkout.mutate(
          { workout },
          {
            onSuccess: ({ workoutDayId }) => {
              onStart(workoutDayId)
              onOpenChange(false)
              setStep("constraints")
              setGeneratedWorkout(null)
            },
          },
        )
        return
      }
      createQuickWorkout.mutate(
        { workout },
        {
          onSuccess: ({ dayId }) => {
            onStart(dayId)
            onOpenChange(false)
            setStep("constraints")
            setGeneratedWorkout(null)
          },
        },
      )
    },
    [
      generationSource,
      commitQuickWorkout,
      createQuickWorkout,
      onStart,
      onOpenChange,
    ],
  )

  const handleSave = useCallback(
    (workout: GeneratedWorkout) => {
      // Drafts always use the legacy hook — see GenerationSource doc.
      createQuickWorkout.mutate(
        { workout, saveAsDraft: true },
        {
          onSuccess: () => {
            toast.success(t("draftSaved"))
            onOpenChange(false)
            setStep("constraints")
            setGeneratedWorkout(null)
          },
        },
      )
    },
    [createQuickWorkout, onOpenChange, t],
  )

  const handleBackFromPreview = useCallback(() => {
    setStep("constraints")
  }, [])

  const handleBackFromAI = useCallback(() => {
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
              onAIGenerate={handleStartAIGeneration}
              isLoading={isLoadingExercises}
            />
          )}
          {step === "ai-generating" && (
            <QuickWorkoutAIGeneratingStep
              constraints={constraints}
              exercisePool={exercisePool}
              onSuccess={handleAISuccess}
              onBackToConstraints={handleBackFromAI}
              onFallbackQuickGenerate={handleFallbackQuickGenerate}
            />
          )}
          {step === "preview" && generatedWorkout && (
            <PreviewStep
              key={previewKey}
              workout={generatedWorkout}
              exercisePool={exercisePool}
              onStart={handleStart}
              onSave={handleSave}
              onShuffle={handleShuffle}
              onBack={handleBackFromPreview}
              isBusy={createQuickWorkout.isPending || commitQuickWorkout.isPending}
            />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
