import { useSyncExternalStore } from "react"
import { useAtomValue } from "jotai"
import { useTranslation } from "react-i18next"
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

export function SyncStatusChip() {
  const { t } = useTranslation()
  const status = useAtomValue(syncStatusAtom)
  const online = useSyncExternalStore(subscribeOnline, getOnlineSnapshot)

  if (status === "idle") {
    if (!online) {
      return (
        <Badge variant="outline" className="text-xs">
          {t("offline")}
        </Badge>
      )
    }
    return null
  }

  const configMap = {
    syncing: { key: "syncing" as const, variant: "secondary" as const },
    synced: { key: "synced" as const, variant: "default" as const },
    failed: { key: "syncFailed" as const, variant: "destructive" as const },
  }

  const config = configMap[status]
  if (!config) return null

  return (
    <Badge variant={config.variant} className="text-xs">
      {t(config.key)}
    </Badge>
  )
}
