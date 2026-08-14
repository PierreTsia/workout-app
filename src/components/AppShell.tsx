import { Suspense } from "react"
import { useSetAtom } from "jotai"
import { Outlet, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { drawerOpenAtom } from "@/store/atoms"
import { useHydrateLocaleFromProfile } from "@/hooks/useProfileLocale"
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
  // Runs where auth is already resolved, which is the earliest the profile's
  // language is readable at all.
  useHydrateLocaleFromProfile()
  const { pathname } = useLocation()
  const hideSessionChrome = pathname.startsWith("/cycle-summary")

  return (
    <AchievementRealtimeProvider>
      {/* Viewport-locked: header is a sibling of <main>, not a sticky overlay.
          Body-scroll + sticky was cropping the session ExerciseStrip (#472). */}
      <div className="flex h-dvh flex-col overflow-hidden bg-background">
        <header className="flex shrink-0 items-center justify-between bg-background px-4 pb-2 pt-4">
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

        <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-y-auto">
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
