import { useSyncExternalStore } from "react"
import { useAtomValue } from "jotai"
import { useTranslation } from "react-i18next"
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

type DotState = "offline" | "syncing" | "synced" | "failed"

const dotConfig: Record<DotState, { key: string; className: string }> = {
  offline: {
    key: "offline",
    className: "rounded-full border border-muted-foreground",
  },
  syncing: {
    key: "syncing",
    className: "rounded-full bg-amber-500 animate-pulse",
  },
  synced: { key: "synced", className: "rounded-full bg-green-500" },
  failed: { key: "syncFailed", className: "rounded-[2px] bg-destructive" },
}

export function SyncStatusChip() {
  const { t } = useTranslation()
  const status = useAtomValue(syncStatusAtom)
  const online = useSyncExternalStore(subscribeOnline, getOnlineSnapshot)

  const state: DotState | null =
    status === "idle" ? (online ? null : "offline") : status

  if (!state) return null

  const config = dotConfig[state]

  return (
    <span
      role="status"
      data-testid="sync-status-dot"
      className="inline-flex items-center"
    >
      <span
        aria-hidden="true"
        className={`h-2.5 w-2.5 shrink-0 ${config.className}`}
      />
      <span className="sr-only">{t(config.key)}</span>
    </span>
  )
}
