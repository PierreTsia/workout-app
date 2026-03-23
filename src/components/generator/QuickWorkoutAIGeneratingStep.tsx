import { useEffect, useReducer, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ArrowLeft, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { generateWorkout } from "@/lib/generateWorkout"
import { VOLUME_MAP } from "@/lib/generatorConfig"
import type { Exercise } from "@/types/database"
import type { Duration, GeneratedWorkout, GeneratorConstraints } from "@/types/generator"
import {
  useAIGenerateWorkout,
  isNetworkError,
  isQuotaError,
} from "@/hooks/useAIGenerateWorkout"

const PHASE_INTERVAL_MS = 2400

interface QuickWorkoutAIGeneratingStepProps {
  constraints: GeneratorConstraints
  exercisePool: Exercise[]
  onSuccess: (workout: GeneratedWorkout) => void
  onBackToConstraints: () => void
  onFallbackQuickGenerate: (workout: GeneratedWorkout) => void
}

export function QuickWorkoutAIGeneratingStep({
  constraints,
  exercisePool,
  onSuccess,
  onBackToConstraints,
  onFallbackQuickGenerate,
}: QuickWorkoutAIGeneratingStepProps) {
  const { t } = useTranslation("generator")
  const mutation = useAIGenerateWorkout({ exercisePool })
  const inflight = useRef(false)
  const mounted = useRef(true)
  const [attempt, retry] = useReducer((n: number) => n + 1, 0)

  const phases = [
    t("aiGenPhase1"),
    t("aiGenPhase2"),
    t("aiGenPhase3"),
    t("aiGenPhase4"),
  ]
  const [phase, setPhase] = useState(0)

  const skeletonCount = Math.min(
    VOLUME_MAP[constraints.duration as Duration].exerciseCount,
    8,
  )

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setPhase((p) => (p + 1) % phases.length)
    }, PHASE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [phases.length])

  useEffect(() => {
    if (inflight.current || exercisePool.length === 0) return
    inflight.current = true

    mutation
      .mutateAsync(constraints)
      .then((result) => {
        if (mounted.current) onSuccess(result)
      })
      .catch((err: unknown) => {
        if (isQuotaError(err)) {
          toast.error(t("errorQuota"))
        } else if (isNetworkError(err)) {
          toast.error(t("networkError"))
        } else {
          toast.error(t("aiError"))
        }
      })
      .finally(() => {
        inflight.current = false
      })
  }, [exercisePool.length, attempt]) // eslint-disable-line react-hooks/exhaustive-deps

  if (exercisePool.length === 0 && !mutation.isError) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit gap-1 px-0 text-muted-foreground"
          onClick={onBackToConstraints}
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backToEdit")}
        </Button>
        <p className="text-center text-sm text-muted-foreground">{t("noExercises")}</p>
      </div>
    )
  }

  if (mutation.isError) {
    const err = mutation.error
    const quota = isQuotaError(err)
    const isNetwork = isNetworkError(err)
    const isTimeout = err instanceof Error && err.message === "timeout"

    const message = quota
      ? t("errorQuota")
      : isNetwork
        ? t("networkError")
        : isTimeout
          ? t("errorTimeout")
          : t("aiError")

    return (
      <div className="flex flex-col gap-4 p-4">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit gap-1 px-0 text-muted-foreground"
          onClick={onBackToConstraints}
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backToEdit")}
        </Button>
        <p className="text-center text-sm text-muted-foreground">{message}</p>
        <div className="flex flex-col gap-2">
          {!quota && (
            <Button onClick={() => { mutation.reset(); retry() }}>
              {t("retry")}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              mutation.reset()
              onFallbackQuickGenerate(generateWorkout(exercisePool, constraints))
            }}
          >
            {t("useQuickGenerateInstead")}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 px-4 py-6">
      <Button
        variant="ghost"
        size="sm"
        className="self-start gap-1 text-muted-foreground"
        onClick={onBackToConstraints}
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backToEdit")}
      </Button>

      <div className="relative flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        <div className="absolute inset-2 animate-pulse rounded-full bg-primary/10" />
        <Sparkles className="relative h-7 w-7 text-primary" />
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <p
          key={phase}
          className="animate-in fade-in slide-in-from-bottom-2 text-center text-sm font-medium duration-300"
        >
          {phases[phase]}
        </p>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-primary"
              style={{ animationDelay: `${i * 200}ms` }}
            />
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {t("aiGenerating")}
      </p>

      <div className="flex w-full max-w-sm flex-col gap-2.5">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div
            key={i}
            className="animate-in fade-in slide-in-from-left-4 flex items-center gap-3 rounded-xl border border-border/50 bg-card/50 p-3 duration-500 fill-mode-backwards"
            style={{ animationDelay: `${400 + i * 200}ms` }}
          >
            <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
            <div className="flex flex-1 flex-col gap-1.5">
              <div
                className="h-3 w-28 animate-pulse rounded bg-muted"
                style={{ animationDelay: `${i * 80}ms` }}
              />
              <div
                className="h-2.5 w-20 animate-pulse rounded bg-muted/60"
                style={{ animationDelay: `${i * 80 + 40}ms` }}
              />
            </div>
            <div className="h-3 w-10 animate-pulse rounded bg-muted/40" />
          </div>
        ))}
      </div>
    </div>
  )
}
