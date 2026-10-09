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
type DotLabelKey = "offline" | "syncing" | "synced" | "syncFailed"

const dotConfig: Record<
  DotState,
  { key: DotLabelKey; className: string }
> = {
  offline: {
    key: "offline",
    className: "rounded-full border border-muted-foreground",
  },
  syncing: {
    key: "syncing",
    className: "rounded-full bg-amber-600 animate-pulse dark:bg-amber-500",
  },
  synced: {
    key: "synced",
    className: "rounded-full bg-green-600 dark:bg-green-500",
  },
  failed: { key: "syncFailed", className: "rounded-[2px] bg-destructive" },
}

export function SyncStatusChip() {
  const { t } = useTranslation()
  const status = useAtomValue(syncStatusAtom)
  const online = useSyncExternalStore(subscribeOnline, getOnlineSnapshot)

  const state: DotState | null =
    status === "idle" ? (online ? null : "offline") : status

  return (
    <>
      {/* Live region stays mounted — and out of the header's flex `gap` (sr-only
          is absolutely positioned) — so the first state change is announced. */}
      <span role="status" className="sr-only">
        {state ? t(dotConfig[state].key) : ""}
      </span>
      {state ? (
        <span
          aria-hidden="true"
          data-testid="sync-status-dot"
          className={`h-2.5 w-2.5 shrink-0 ${dotConfig[state].className}`}
        />
      ) : null}
    </>
  )
}
