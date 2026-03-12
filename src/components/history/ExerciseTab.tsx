import { useState } from "react"
import { ChevronsUpDown, Check } from "lucide-react"
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
import { useExerciseHistory } from "@/hooks/useExerciseHistory"
import { ExerciseChart } from "@/components/history/ExerciseChart"

export function ExerciseTab() {
  const { data: exercises, isLoading } = useExerciseHistory()
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selectedExercise = exercises?.find((e) => e.id === selectedId)

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
            {selectedExercise ? selectedExercise.name : "Select an exercise…"}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search exercises…" />
            <CommandList>
              <CommandEmpty>No exercises found.</CommandEmpty>
              <CommandGroup>
                {exercises?.map((ex) => (
                  <CommandItem
                    key={ex.id}
                    value={ex.name}
                    onSelect={() => {
                      setSelectedId(ex.id === selectedId ? null : ex.id)
                      setOpen(false)
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
          Pick an exercise above to see your progression.
        </p>
      )}
    </div>
  )
}
