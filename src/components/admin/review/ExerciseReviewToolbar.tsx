import { useState } from "react"
import { Copy, Check, FileJson } from "lucide-react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { buildImagePrompt } from "@/lib/imagePrompt"
import { buildLlmReviewPrompt } from "@/lib/exerciseExport"
import { useExerciseFilterOptions } from "@/hooks/useExerciseFilterOptions"
import type { Exercise } from "@/types/database"

interface ExerciseReviewToolbarProps {
  exercise: Exercise
}

export function ExerciseReviewToolbar({
  exercise,
}: ExerciseReviewToolbarProps) {
  const { t } = useTranslation("admin")
  const { data: filterOptions } = useExerciseFilterOptions()
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [copiedJson, setCopiedJson] = useState(false)

  const promptName = exercise.name_en || exercise.name

  async function handleCopyIllustrationPrompt() {
    const prompt = buildImagePrompt(promptName)
    try {
      await navigator.clipboard.writeText(prompt)
      setCopiedPrompt(true)
      setTimeout(() => setCopiedPrompt(false), 2000)
    } catch {
      toast.info(prompt, { duration: 8000 })
    }
  }

  async function handleCopyLlmJson() {
    const prompt = buildLlmReviewPrompt(exercise, filterOptions ?? undefined)
    try {
      await navigator.clipboard.writeText(prompt)
      setCopiedJson(true)
      toast.success(t("review.jsonCopied"))
      setTimeout(() => setCopiedJson(false), 2000)
    } catch {
      toast.info(prompt, { duration: 8000 })
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={handleCopyIllustrationPrompt}
      >
        {copiedPrompt ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
        {copiedPrompt
          ? t("review.copied")
          : t("review.copyIllustrationPrompt")}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={handleCopyLlmJson}
      >
        {copiedJson ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <FileJson className="h-4 w-4" />
        )}
        {copiedJson ? t("review.copied") : t("review.exportJsonLlm")}
      </Button>
    </div>
  )
}
