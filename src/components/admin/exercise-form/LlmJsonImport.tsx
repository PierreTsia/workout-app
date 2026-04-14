import { useState } from "react"
import { useFormContext } from "react-hook-form"
import { ClipboardPaste, ChevronDown } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { fromLlmJson } from "./transforms"
import type { ExerciseFormValues } from "./schema"

function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "")
}

export function LlmJsonImport() {
  const { t } = useTranslation("admin")
  const methods = useFormContext<ExerciseFormValues>()
  const [jsonInput, setJsonInput] = useState("")
  const [open, setOpen] = useState(false)

  function handleApply() {
    const cleaned = stripCodeFences(jsonInput.trim())
    if (!cleaned) return

    try {
      const parsed = JSON.parse(cleaned) as Record<string, unknown>
      const patch = fromLlmJson(parsed)
      const current = methods.getValues()
      methods.reset({ ...current, ...patch }, { keepDefaultValues: true })
      toast.success(t("review.importApplied"))
      setJsonInput("")
      setOpen(false)
    } catch {
      toast.error(t("review.importParseError"))
    }
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground"
        >
          <ClipboardPaste className="h-4 w-4" />
          {t("review.importJsonLabel")}
          <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 data-[state=open]:-rotate-180" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-3 flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">
            {t("review.importJsonHint")}
          </p>
          <Textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder='{ "name": "...", "instructions": { ... } }'
            className="min-h-[120px] font-mono text-xs"
          />
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              onClick={handleApply}
              disabled={!jsonInput.trim()}
            >
              {t("review.importApplyButton")}
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
