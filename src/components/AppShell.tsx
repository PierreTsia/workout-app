import { Suspense } from "react"
import { useSetAtom } from "jotai"
import { Outlet, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { drawerOpenAtom } from "@/store/atoms"
import { SessionTimerChip } from "@/components/SessionTimerChip"
import { SyncStatusChip } from "@/components/SyncStatusChip"
import { SideDrawer } from "@/components/SideDrawer"
import { InstallBanner } from "@/components/InstallBanner"
import { RestTimerPill } from "@/components/RestTimerPill"
import { RouteSkeleton } from "@/components/RouteSkeleton"
import { AchievementRealtimeProvider } from "@/components/achievements/AchievementRealtimeProvider"
import { AchievementUnlockOverlay } from "@/components/achievements/AchievementUnlockOverlay"

export function AppShell() {
  const { t } = useTranslation()
  const setDrawerOpen = useSetAtom(drawerOpenAtom)
  const { pathname } = useLocation()
  const hideSessionChrome = pathname.startsWith("/cycle-summary")

  return (
    <AchievementRealtimeProvider>
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
            {!hideSessionChrome && <SessionTimerChip />}
          </div>
          <div className="flex items-center gap-2">
            {!hideSessionChrome && <RestTimerPill />}
            <SyncStatusChip />
          </div>
        </header>

        <SideDrawer />
        <InstallBanner />
        <AchievementUnlockOverlay />

        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
          {/* Single Suspense boundary for all lazy routes nested under AppShell.
              Keeps header + side drawer + chips stable while the next chunk
              downloads (`RouteSkeleton` only swaps inside `<main>`). */}
          <Suspense fallback={<RouteSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </AchievementRealtimeProvider>
  )
}
