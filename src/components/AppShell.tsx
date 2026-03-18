import { useSetAtom } from "jotai"
import { Outlet } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { drawerOpenAtom } from "@/store/atoms"
import { SessionTimerChip } from "@/components/SessionTimerChip"
import { SyncStatusChip } from "@/components/SyncStatusChip"
import { SideDrawer } from "@/components/SideDrawer"
import { InstallBanner } from "@/components/InstallBanner"
import { RestTimerPill } from "@/components/RestTimerPill"

export function AppShell() {
  const { t } = useTranslation()
  const setDrawerOpen = useSetAtom(drawerOpenAtom)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-background px-4 pb-2 pt-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDrawerOpen(true)}
            className="text-2xl text-muted-foreground"
            aria-label={t("openMenu")}
          >
            ☰
          </button>
          <SessionTimerChip />
        </div>
        <div className="flex items-center gap-2">
          <RestTimerPill />
          <SyncStatusChip />
        </div>
      </header>

      <SideDrawer />
      <InstallBanner />

      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  )
}
