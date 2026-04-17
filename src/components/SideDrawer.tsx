import { useEffect, useState } from "react"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { Link, useNavigate } from "react-router-dom"
import { useTheme } from "next-themes"
import { useTranslation } from "react-i18next"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  LogOut,
  Download,
  Info,
  Shield,
  Library,
  ChevronDown,
  Zap,
  History,
  UserRound,
  Settings,
  Trophy,
} from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  authAtom,
  drawerOpenAtom,
  localeAtom,
  queueSyncMetaAtom,
  sessionAtom,
  weightUnitAtom,
  quickSheetOpenAtom,
} from "@/store/atoms"
import { supabase } from "@/lib/supabase"
import { useInstallPrompt } from "@/hooks/useInstallPrompt"
import { useUserProfile } from "@/hooks/useUserProfile"
import { useBadgeStatus } from "@/hooks/useBadgeStatus"
import { resolveAvatarUrl, resolveDisplayName } from "@/lib/userDisplay"
import { rankColorText, resolveActiveTitle } from "@/lib/achievementUtils"
import { AdminOnly } from "@/components/admin/AdminOnly"
import { IOSInstallModal } from "@/components/IOSInstallModal"
import { isIOS, isStandalone } from "@/lib/platform"
import { cn } from "@/lib/utils"

const navRowClass =
  "h-11 w-full justify-start gap-3 rounded-xl px-2.5 text-sm font-medium text-foreground hover:bg-muted/55 active:bg-muted/75"

const navIconClass = "h-4.5 w-4.5 shrink-0 opacity-70"

function SegmentedButton<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex overflow-hidden rounded-md border border-border/80 bg-background/50">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "min-w-9 px-2.5 py-1 text-xs font-semibold transition-colors",
            value === opt.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function SideDrawer() {
  const { t, i18n } = useTranslation(["common", "settings", "account", "admin", "library", "achievements"])
  const [open, setOpen] = useAtom(drawerOpenAtom)
  const [locale, setLocale] = useAtom(localeAtom)
  const [weightUnit, setWeightUnit] = useAtom(weightUnitAtom)
  const user = useAtomValue(authAtom)
  const { data: profile } = useUserProfile()
  const { data: badgeRows = [] } = useBadgeStatus()
  const queueMeta = useAtomValue(queueSyncMetaAtom)
  const session = useAtomValue(sessionAtom)
  const { resolvedTheme, setTheme } = useTheme()
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false)
  const [iosModalOpen, setIosModalOpen] = useState(false)
  const setQuickSheetOpen = useSetAtom(quickSheetOpenAtom)
  const navigate = useNavigate()
  const { canInstall, promptInstall } = useInstallPrompt()

  const showInstallButton = (canInstall || isIOS()) && !isStandalone()

  useEffect(() => {
    if (i18n.language !== locale) {
      i18n.changeLanguage(locale)
    }
  }, [locale, i18n])

  function closeDrawer() {
    setOpen(false)
  }

  function handleSignOut() {
    if (session.isActive || queueMeta.pendingCount > 0) {
      setSignOutConfirmOpen(true)
      return
    }
    supabase.auth.signOut()
    closeDrawer()
  }

  function confirmSignOut() {
    setSignOutConfirmOpen(false)
    supabase.auth.signOut()
    closeDrawer()
  }

  function handleLocaleChange(v: "en" | "fr") {
    setLocale(v)
    i18n.changeLanguage(v)
  }

  const profileDisplayName = user
    ? resolveDisplayName(user, profile) || t("common:guest")
    : t("common:guest")
  const userEmail = user?.email ?? null
  const showEmailSubline =
    userEmail !== null &&
    profileDisplayName.trim().toLowerCase() !== userEmail.trim().toLowerCase()
  const activeTitle = resolveActiveTitle(profile, badgeRows)
  const activeTitleText = activeTitle
    ? i18n.language === "fr" ? activeTitle.title_fr : activeTitle.title_en
    : null

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="left"
        className="flex w-full max-w-[min(20rem,calc(100vw-0.75rem))] flex-col border-border/60 bg-card p-0 px-2.5 pb-6 pt-10 shadow-xl"
      >
        <SheetTitle className="sr-only">{t("common:menu")}</SheetTitle>

        <div className="flex min-h-0 flex-1 flex-col gap-1">
          <Link
            to="/account"
            onClick={closeDrawer}
            aria-label={t("account:openAccountAria")}
            className={cn(
              "group flex items-center gap-3 rounded-2xl p-2.5 transition-colors",
              "bg-muted/30 hover:bg-muted/45 active:bg-muted/55",
              "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
            )}
          >
            <Avatar className="h-11 w-11 shrink-0 ring-1 ring-border/60 ring-offset-2 ring-offset-card">
              <AvatarImage
                src={resolveAvatarUrl(user, profile)}
                alt=""
                referrerPolicy="no-referrer"
              />
              <AvatarFallback>
                <UserRound className="h-5 w-5 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 text-left">
              <p
                className={cn(
                  "font-semibold leading-snug tracking-tight text-foreground",
                  showEmailSubline ? "line-clamp-1 text-sm" : "line-clamp-2 text-[13px]",
                )}
                title={profileDisplayName}
              >
                {profileDisplayName}
              </p>
              {showEmailSubline ? (
                <p
                  className="mt-0.5 truncate font-mono text-[11px] leading-tight text-muted-foreground"
                  title={userEmail ?? undefined}
                >
                  {userEmail}
                </p>
              ) : user ? null : (
                <p className="mt-0.5 text-xs text-muted-foreground">{t("common:notSignedIn")}</p>
              )}
              {activeTitleText && activeTitle && (
                <p
                  className={cn(
                    "mt-0.5 truncate text-[11px] font-semibold italic leading-tight",
                    rankColorText[activeTitle.rank],
                  )}
                >
                  {activeTitleText}
                </p>
              )}
            </div>
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                "text-muted-foreground transition-colors",
                "group-hover:bg-background/60 group-hover:text-primary",
              )}
              aria-hidden
            >
              <Settings className="h-5 w-5" strokeWidth={1.75} />
            </span>
          </Link>

          <Separator className="my-2 bg-border/50" />

          <nav className="flex flex-col gap-0.5 py-0.5" aria-label={t("common:menu")}>
            <Button variant="ghost" className={navRowClass} asChild>
              <Link to="/history" onClick={closeDrawer} className="flex items-center">
                <History className={navIconClass} strokeWidth={1.75} />
                {t("common:history")}
              </Link>
            </Button>
            <Button variant="ghost" className={navRowClass} asChild>
              <Link to="/achievements" onClick={closeDrawer} className="flex items-center">
                <Trophy className={navIconClass} strokeWidth={1.75} />
                {t("achievements:drawerAchievements")}
              </Link>
            </Button>
            <Collapsible defaultOpen>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(navRowClass, "group justify-between pr-2")}
                  type="button"
                >
                  <span className="flex items-center gap-3">
                    <Library className={navIconClass} strokeWidth={1.75} />
                    {t("common:library")}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-0.5 flex flex-col gap-0.5 border-l border-border/40 pl-4 ml-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 justify-start px-2 text-sm text-muted-foreground hover:text-foreground"
                    asChild
                  >
                    <Link to="/library/programs" onClick={closeDrawer}>
                      {t("library:drawerPrograms")}
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 justify-start px-2 text-sm text-muted-foreground hover:text-foreground"
                    asChild
                  >
                    <Link to="/library/exercises" onClick={closeDrawer}>
                      {t("library:drawerExercises")}
                    </Link>
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
            <Button
              variant="ghost"
              className={navRowClass}
              onClick={() => {
                closeDrawer()
                navigate("/")
                setQuickSheetOpen(true)
              }}
            >
              <Zap className={navIconClass} strokeWidth={1.75} />
              {t("common:quickWorkout")}
            </Button>
            <AdminOnly>
              <Collapsible defaultOpen>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className={cn(navRowClass, "group justify-between pr-2")}>
                    <span className="flex items-center gap-3">
                      <Shield className={navIconClass} strokeWidth={1.75} />
                      {t("common:admin")}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-0.5 flex flex-col gap-0.5 border-l border-border/40 pl-4 ml-4">
                    <Button variant="ghost" size="sm" className="h-9 justify-start px-2 text-sm text-muted-foreground hover:text-foreground" asChild>
                      <Link to="/admin" onClick={closeDrawer}>
                        {t("admin:overview")}
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-9 justify-start px-2 text-sm text-muted-foreground hover:text-foreground" asChild>
                      <Link to="/admin/exercises" onClick={closeDrawer}>
                        {t("common:adminExercises")}
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-9 justify-start px-2 text-sm text-muted-foreground hover:text-foreground" asChild>
                      <Link to="/admin/review" onClick={closeDrawer}>
                        {t("admin:review.navLabel")}
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-9 justify-start px-2 text-sm text-muted-foreground hover:text-foreground" asChild>
                      <Link to="/admin/enrichment" onClick={closeDrawer}>
                        {t("admin:enrichment.navLabel")}
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-9 justify-start px-2 text-sm text-muted-foreground hover:text-foreground" asChild>
                      <Link to="/admin/feedback" onClick={closeDrawer}>
                        {t("common:adminFeedback")}
                      </Link>
                    </Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </AdminOnly>
          </nav>

          <Separator className="my-2 bg-border/50" />

          <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
            <p className="mb-3 px-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {t("settings:drawerSectionPreferences")}
            </p>
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-foreground">{t("common:darkMode")}</span>
                <Switch
                  checked={resolvedTheme === "dark"}
                  onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="shrink-0 text-sm text-foreground">{t("settings:language")}</span>
                <SegmentedButton
                  value={locale}
                  options={[
                    { value: "fr" as const, label: "FR" },
                    { value: "en" as const, label: "EN" },
                  ]}
                  onChange={handleLocaleChange}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="shrink-0 text-sm text-foreground">{t("settings:weightUnit")}</span>
                <SegmentedButton
                  value={weightUnit}
                  options={[
                    { value: "kg" as const, label: "kg" },
                    { value: "lbs" as const, label: "lbs" },
                  ]}
                  onChange={setWeightUnit}
                />
              </div>
            </div>
          </div>

          <Separator className="my-2 bg-border/50" />

          <div className="flex flex-col gap-0.5 pb-1">
            <Button variant="ghost" className={cn(navRowClass, "h-10 text-muted-foreground hover:text-foreground")} size="sm" asChild>
              <Link to="/about" onClick={closeDrawer} className="flex items-center">
                <Info className={navIconClass} strokeWidth={1.75} />
                {t("common:about")}
              </Link>
            </Button>
            <Button variant="ghost" className={cn(navRowClass, "h-10 text-muted-foreground hover:text-foreground")} size="sm" asChild>
              <Link to="/privacy" onClick={closeDrawer} className="flex items-center">
                <Shield className={navIconClass} strokeWidth={1.75} />
                {t("common:privacy")}
              </Link>
            </Button>
            {showInstallButton && (
              <Button
                variant="ghost"
                className={cn(navRowClass, "h-10 text-muted-foreground hover:text-foreground")}
                size="sm"
                onClick={isIOS() ? () => setIosModalOpen(true) : promptInstall}
              >
                <Download className={navIconClass} strokeWidth={1.75} />
                {t("common:installApp")}
              </Button>
            )}
            <Button
              variant="ghost"
              className={cn(navRowClass, "h-10 text-muted-foreground hover:text-foreground")}
              size="sm"
              onClick={handleSignOut}
            >
              <LogOut className={navIconClass} strokeWidth={1.75} />
              {t("common:signOut")}
            </Button>
          </div>
        </div>
      </SheetContent>

      <Dialog open={signOutConfirmOpen} onOpenChange={setSignOutConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {session.isActive
                ? t("common:activeSessionTitle")
                : t("common:unsavedTitle")}
            </DialogTitle>
            <DialogDescription>
              {session.isActive
                ? t("common:activeSessionDescription")
                : t("common:unsavedDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setSignOutConfirmOpen(false)}>
              {t("common:cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmSignOut}>
              {t("common:signOut")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <IOSInstallModal open={iosModalOpen} onOpenChange={setIosModalOpen} />
    </Sheet>
  )
}
