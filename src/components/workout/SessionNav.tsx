import { useState } from "react"
import { useAtom } from "jotai"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { sessionAtom } from "@/store/atoms"
import type { WorkoutExercise } from "@/types/database"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface SessionNavProps {
  exercises: WorkoutExercise[]
  onFinish: () => void
}

export function SessionNav({ exercises, onFinish }: SessionNavProps) {
  const [session, setSession] = useAtom(sessionAtom)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const isFirst = session.exerciseIndex === 0
  const isLast = session.exerciseIndex >= exercises.length - 1

  function daySets() {
    return exercises.flatMap((ex) => session.setsData[ex.id] ?? [])
  }

  function prev() {
    if (isFirst) return
    setSession((s) => ({ ...s, exerciseIndex: s.exerciseIndex - 1 }))
  }

  function next() {
    if (isLast) {
      handleFinishAttempt()
      return
    }
    setSession((s) => ({ ...s, exerciseIndex: s.exerciseIndex + 1 }))
  }

  function handleFinishAttempt() {
    const skipped = daySets().filter((s) => !s.done).length
    if (skipped > 0) {
      setConfirmOpen(true)
    } else {
      onFinish()
    }
  }

  function handleConfirmFinish() {
    setConfirmOpen(false)
    onFinish()
  }

  const skippedCount = daySets().filter((s) => !s.done).length

  return (
    <>
      <div className="sticky bottom-0 flex items-center justify-between gap-4 border-t border-border bg-background px-4 py-3">
        <Button
          variant="outline"
          size="lg"
          onClick={prev}
          disabled={isFirst}
          className="flex-1"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Previous
        </Button>
        <Button
          size="lg"
          onClick={next}
          className="flex-1"
        >
          {isLast ? "Finish" : "Next"}
          {!isLast && <ChevronRight className="ml-1 h-4 w-4" />}
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finish session?</DialogTitle>
            <DialogDescription>
              You have {skippedCount} skipped set{skippedCount !== 1 && "s"}.
              Finish anyway?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmFinish}>Finish</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
