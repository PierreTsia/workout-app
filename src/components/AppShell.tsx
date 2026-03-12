import { useSetAtom } from "jotai"
import { Outlet } from "react-router-dom"
import { drawerOpenAtom } from "@/store/atoms"
import { SessionTimerChip } from "@/components/SessionTimerChip"
import { SyncStatusChip } from "@/components/SyncStatusChip"
import { SideDrawer } from "@/components/SideDrawer"
import { InstallBanner } from "@/components/InstallBanner"

export function AppShell() {
  const setDrawerOpen = useSetAtom(drawerOpenAtom)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top Bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between bg-background px-4 pb-2 pt-4">
        <button
          onClick={() => setDrawerOpen(true)}
          className="text-2xl text-muted-foreground"
          aria-label="Open menu"
        >
          ☰
        </button>
        <SessionTimerChip />
        <SyncStatusChip />
      </header>

      <SideDrawer />
      <InstallBanner />

      {/* Screen content */}
      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  )
}
