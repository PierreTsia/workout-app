import { useTranslation } from "react-i18next"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { DayCard } from "@/components/library/DayCard"
import type { EnrichedTemplate } from "@/hooks/useTemplatesWithEquipment"

interface TemplateDetailSheetProps {
  template: EnrichedTemplate | null
  open: boolean
  onOpenChange: (open: boolean) => void
  isSaved: boolean
  onSave: () => void
  onStart: () => void
  isSaving: boolean
}

export function TemplateDetailSheet({
  template,
  open,
  onOpenChange,
  isSaved,
  onSave,
  onStart,
  isSaving,
}: TemplateDetailSheetProps) {
  const { t } = useTranslation("library")

  if (!template) return null

  function handleStart() {
    onOpenChange(false)
    setTimeout(() => {
      onStart()
    }, 300)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{template.name}</SheetTitle>
          {template.description && (
            <p className="text-sm text-muted-foreground">{template.description}</p>
          )}
        </SheetHeader>

        <div className="mt-4 grid gap-3">
          {[...template.template_days]
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((day) => (
              <DayCard
                key={day.id}
                label={day.day_label}
                exerciseCount={day.template_exercises.length}
                muscleFocus={day.muscle_focus}
                exercises={day.template_exercises.map((te) => ({
                  id: te.id,
                  emoji: te.exercise?.emoji ?? "🏋️",
                  name: te.exercise?.name ?? "Exercise",
                  sets: te.sets,
                  reps: te.rep_range,
                  restSeconds: te.rest_seconds,
                  sortOrder: te.sort_order,
                }))}
              />
            ))}
        </div>

        <div className="sticky bottom-0 mt-4 flex gap-2 border-t bg-background pt-3 pb-2">
          {isSaved ? (
            <Button variant="outline" className="flex-1" disabled>
              {t("saved")}
            </Button>
          ) : (
            <Button variant="outline" className="flex-1" onClick={onSave} disabled={isSaving}>
              {t("save")}
            </Button>
          )}
          <Button className="flex-1" onClick={handleStart}>
            {t("start")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
