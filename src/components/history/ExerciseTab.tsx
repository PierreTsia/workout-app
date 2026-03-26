import { useState, useMemo } from "react"
import { ChevronsUpDown, Check } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"
import { normalizeForSearch } from "@/lib/search"
import { useExerciseHistory } from "@/hooks/useExerciseHistory"
import { ExerciseChart } from "@/components/history/ExerciseChart"

export function ExerciseTab() {
  const { t } = useTranslation("history")
  const { data: exercises, isLoading } = useExerciseHistory()
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const selectedExercise = exercises?.find((e) => e.id === selectedId)

  const filtered = useMemo(() => {
    if (!exercises) return []
    const term = normalizeForSearch(search.trim())
    if (term.length === 0) return exercises
    return exercises.filter((e) => normalizeForSearch(e.name).includes(term))
  }, [exercises, search])

  return (
    <div className="flex flex-col gap-4">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={isLoading}
          >
            {selectedExercise ? selectedExercise.name : t("selectExercise")}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={t("searchExercises")}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>{t("noExercisesFound")}</CommandEmpty>
              <CommandGroup>
                {filtered.map((ex) => (
                  <CommandItem
                    key={ex.id}
                    value={ex.name}
                    onSelect={() => {
                      setSelectedId(ex.id === selectedId ? null : ex.id)
                      setOpen(false)
                      setSearch("")
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedId === ex.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {ex.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedId ? (
        <ExerciseChart exerciseId={selectedId} />
      ) : (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t("pickExercise")}
        </p>
      )}
    </div>
  )
}
