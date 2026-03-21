import { useEffect, useReducer, useRef } from "react"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAIGenerateProgram, isNetworkError, isQuotaError } from "@/hooks/useAIGenerateProgram"
import { useExerciseLibrary } from "@/hooks/useExerciseLibrary"
import type { GenerateProgramConstraints, AIGeneratedProgram } from "@/types/aiProgram"

interface AIGeneratingStepProps {
  constraints: GenerateProgramConstraints
  onSuccess: (result: AIGeneratedProgram) => void
  onFallbackTemplate: () => void
  onFallbackBlank: () => void
}

export function AIGeneratingStep({
  constraints,
  onSuccess,
  onFallbackTemplate,
  onFallbackBlank,
}: AIGeneratingStepProps) {
  const { t } = useTranslation("create-program")
  const { data: exercisePool } = useExerciseLibrary()
  const mutation = useAIGenerateProgram({ exercisePool: exercisePool ?? [] })
  const inflight = useRef(false)
  const [attempt, retry] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    if (inflight.current || !exercisePool) return
    inflight.current = true

    mutation
      .mutateAsync(constraints)
      .then(onSuccess)
      .catch(() => {})
      .finally(() => { inflight.current = false })
  }, [exercisePool, attempt]) // eslint-disable-line react-hooks/exhaustive-deps

  if (mutation.isError) {
    const err = mutation.error
    const quota = isQuotaError(err)
    const isNetwork = isNetworkError(err)
    const isTimeout = err instanceof Error && err.message === "timeout"

    const message = quota
      ? t("errorQuota")
      : isNetwork
        ? t("errorNetwork")
        : isTimeout
          ? t("errorTimeout")
          : t("errorGeneric")

    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
        <p className="text-center text-sm text-muted-foreground">{message}</p>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          {!quota && (
            <Button onClick={() => { mutation.reset(); retry() }}>
              {t("retry")}
            </Button>
          )}
          <Button variant="outline" onClick={onFallbackTemplate}>
            {t("useTemplate")}
          </Button>
          <Button variant="ghost" onClick={onFallbackBlank}>
            {t("startBlank")}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{t("generating")}</p>

      <div className="mt-4 flex w-full max-w-xs flex-col gap-2">
        {Array.from({ length: Math.min(constraints.daysPerWeek, 6) }).map((_, i) => (
          <div
            key={i}
            className="h-12 animate-pulse rounded-lg bg-muted"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
