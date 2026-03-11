import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export function WorkoutPage() {
  const [exitDialogOpen, setExitDialogOpen] = useState(false)

  const handlePopState = useCallback(() => {
    setExitDialogOpen(true)
  }, [])

  useEffect(() => {
    history.pushState(null, "", location.href)
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [handlePopState])

  function handleCancel() {
    setExitDialogOpen(false)
    history.pushState(null, "", location.href)
  }

  function handleExit() {
    setExitDialogOpen(false)
    window.close()
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-2xl font-bold">Workout</h1>
      <Badge className="bg-primary text-primary-foreground">Active</Badge>

      <Dialog open={exitDialogOpen} onOpenChange={setExitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exit app?</DialogTitle>
            <DialogDescription>
              Your session state is automatically saved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleExit}>
              Exit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
