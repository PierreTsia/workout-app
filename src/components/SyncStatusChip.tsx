import { useSyncExternalStore } from "react"
import { useAtomValue } from "jotai"
import { Badge } from "@/components/ui/badge"
import { syncStatusAtom } from "@/store/atoms"

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb)
  window.addEventListener("offline", cb)
  return () => {
    window.removeEventListener("online", cb)
    window.removeEventListener("offline", cb)
  }
}

function getOnlineSnapshot() {
  return navigator.onLine
}

const statusConfig = {
  idle: null,
  syncing: { label: "Syncing\u2026", variant: "secondary" as const },
  synced: { label: "Synced", variant: "default" as const },
  failed: { label: "Sync failed", variant: "destructive" as const },
} as const

export function SyncStatusChip() {
  const status = useAtomValue(syncStatusAtom)
  const online = useSyncExternalStore(subscribeOnline, getOnlineSnapshot)

  if (status === "idle") {
    if (!online) {
      return (
        <Badge variant="outline" className="text-xs">
          Offline
        </Badge>
      )
    }
    return null
  }

  const config = statusConfig[status]
  if (!config) return null

  return (
    <Badge variant={config.variant} className="text-xs">
      {config.label}
    </Badge>
  )
}
