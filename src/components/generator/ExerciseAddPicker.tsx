import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { ExerciseThumbnail } from "@/components/exercise/ExerciseThumbnail"
import type { Exercise } from "@/types/database"

interface ExerciseAddPickerProps {
  pool: Exercise[]
  currentExerciseIds: string[]
  onSelect: (exercise: Exercise) => void
  onClose: () => void
}

export function ExerciseAddPicker({
  pool,
  currentExerciseIds,
  onSelect,
  onClose,
}: ExerciseAddPickerProps) {
  const { t } = useTranslation("generator")
  const [search, setSearch] = useState("")

  const candidates = useMemo(() => {
    const available = pool.filter(
      (e) => !currentExerciseIds.includes(e.id),
    )
    const term = search.trim().toLowerCase()
    if (term.length === 0) return available
    return available.filter(
      (e) =>
        e.name.toLowerCase().includes(term) ||
        e.name_en?.toLowerCase().includes(term),
    )
  }, [pool, currentExerciseIds, search])

  const grouped = useMemo(() => {
    const map = new Map<string, Exercise[]>()
    for (const ex of candidates) {
      const list = map.get(ex.muscle_group) ?? []
      list.push(ex)
      map.set(ex.muscle_group, list)
    }
    return map
  }, [candidates])

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{t("addExerciseTitle")}</span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {t("cancel")}
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchExercise")}
          className="h-8 pl-7 text-sm"
        />
      </div>

      {candidates.length === 0 ? (
        <p className="py-2 text-center text-xs text-muted-foreground">
          {t("noSwapCandidates")}
        </p>
      ) : (
        <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {[...grouped.entries()].map(([group, exercises]) => (
            <div key={group}>
              <span className="sticky top-0 block bg-card px-1 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group}
              </span>
              {exercises.map((exercise) => (
                <button
                  key={exercise.id}
                  type="button"
                  onClick={() => onSelect(exercise)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                  )}
                >
                  <ExerciseThumbnail
                    imageUrl={exercise.image_url}
                    emoji={exercise.emoji}
                    className="h-7 w-7 rounded"
                  />
                  <span className="truncate">{exercise.name}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
