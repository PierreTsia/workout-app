import { WifiOff } from "lucide-react"

export function OfflineBlock() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <WifiOff className="h-16 w-16 text-muted-foreground/50" />
      <h2 className="text-xl font-bold">Internet required for editing</h2>
      <p className="text-sm text-muted-foreground">
        The Workout Builder needs a connection to save changes. Please reconnect
        and try again.
      </p>
    </div>
  )
}
