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
  weightUnitAtom,
  quickSheetOpenAtom,
} from "@/store/atoms"
import { supabase } from "@/lib/supabase"
import { useInstallPrompt } from "@/hooks/useInstallPrompt"
import { useUserProfile } from "@/hooks/useUserProfile"
import { resolveAvatarUrl, resolveDisplayName } from "@/lib/userDisplay"
import { AdminOnly } from "@/components/admin/AdminOnly"
import { IOSInstallModal } from "@/components/IOSInstallModal"
import { isIOS, isStandalone } from "@/lib/platform"

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
    <div className="flex overflow-hidden rounded-lg border border-border">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={
            "px-3 py-1.5 text-xs font-medium transition-colors " +
            (value === opt.value
              ? "bg-primary text-primary-foreground"
              : "bg-muted/30 text-muted-foreground hover:bg-muted/60")
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function SideDrawer() {
  const { t, i18n } = useTranslation(["common", "settings", "account"])
  const [open, setOpen] = useAtom(drawerOpenAtom)
  const [locale, setLocale] = useAtom(localeAtom)
  const [weightUnit, setWeightUnit] = useAtom(weightUnitAtom)
  const user = useAtomValue(authAtom)
  const { data: profile } = useUserProfile()
  const queueMeta = useAtomValue(queueSyncMetaAtom)
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
    if (queueMeta.pendingCount > 0) {
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

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="left"
        className="w-72 max-w-[min(18rem,100vw-1.5rem)] bg-card p-0 px-3 pb-5 pt-11"
      >
        <SheetTitle className="sr-only">{t("common:menu")}</SheetTitle>

        <div className="flex flex-col gap-2 pb-2">
          <Link
            to="/account"
            onClick={closeDrawer}
            aria-label={t("account:openAccountAria")}
            className={
              "group flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-2 py-2 " +
              "transition-colors hover:border-primary/35 hover:bg-muted/50 active:bg-muted/65 " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            }
          >
            <Avatar className="h-9 w-9 shrink-0 border border-border">
              <AvatarImage
                src={resolveAvatarUrl(user, profile)}
                alt=""
                referrerPolicy="no-referrer"
              />
              <AvatarFallback>
                <UserRound className="h-4 w-4 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 text-left">
              <p className="line-clamp-2 break-words text-sm font-medium leading-snug text-foreground">
                {profileDisplayName}
              </p>
              {showEmailSubline ? (
                <p className="mt-0.5 line-clamp-2 break-all text-[11px] leading-snug text-muted-foreground">
                  {userEmail}
                </p>
              ) : user ? null : (
                <p className="mt-0.5 text-[11px] text-muted-foreground">{t("common:notSignedIn")}</p>
              )}
            </div>
            <div
              className="shrink-0 rounded-md border border-primary/30 bg-primary/10 p-1.5 transition-colors group-hover:border-primary/45 group-hover:bg-primary/15"
              aria-hidden
            >
              <Settings className="h-4 w-4 text-primary" />
            </div>
          </Link>

          <Separator />

          <nav className="flex flex-col gap-1 py-2">
            <Button variant="ghost" className="justify-start gap-2" asChild>
              <Link to="/history" onClick={closeDrawer}>
                <History className="h-4 w-4" />
                {t("common:history")}
              </Link>
            </Button>
            <Button variant="ghost" className="justify-start gap-2" asChild>
              <Link to="/library" onClick={closeDrawer}>
                <Library className="h-4 w-4" />
                {t("common:library")}
              </Link>
            </Button>
            <Button
              variant="ghost"
              className="justify-start gap-2"
              onClick={() => {
                closeDrawer()
                navigate("/")
                setQuickSheetOpen(true)
              }}
            >
              <Zap className="h-4 w-4" />
              {t("common:quickWorkout")}
            </Button>
            <AdminOnly>
              <Collapsible defaultOpen>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      {t("common:admin")}
                    </span>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200 [[data-state=closed]>&]:rotate-[-90deg]" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-6 flex flex-col gap-1">
                    <Button variant="ghost" size="sm" className="justify-start" asChild>
                      <Link to="/admin/exercises" onClick={closeDrawer}>
                        {t("common:adminExercises")}
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" className="justify-start" asChild>
                      <Link to="/admin/feedback" onClick={closeDrawer}>
                        {t("common:adminFeedback")}
                      </Link>
                    </Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </AdminOnly>
          </nav>

          <Separator />

          <div className="flex flex-col gap-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">{t("common:darkMode")}</span>
              <Switch
                checked={resolvedTheme === "dark"}
                onCheckedChange={(checked) =>
                  setTheme(checked ? "dark" : "light")
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">{t("settings:language")}</span>
              <SegmentedButton
                value={locale}
                options={[
                  { value: "fr" as const, label: "FR" },
                  { value: "en" as const, label: "EN" },
                ]}
                onChange={handleLocaleChange}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">{t("settings:weightUnit")}</span>
              <SegmentedButton
                value={weightUnit}
                options={[
                  { value: "kg" as const, label: "kg" },
                  { value: "lbs" as const, label: "lbs" },
                ]}
                onChange={setWeightUnit}
              />
            </div>

            <Separator />

            <Button
              variant="ghost"
              size="sm"
              className="justify-start text-muted-foreground"
              asChild
            >
              <Link to="/about" onClick={closeDrawer}>
                <Info className="h-4 w-4" />
                {t("common:about")}
              </Link>
            </Button>

            {showInstallButton && (
              <Button
                variant="ghost"
                size="sm"
                className="justify-start text-muted-foreground"
                onClick={isIOS() ? () => setIosModalOpen(true) : promptInstall}
              >
                <Download className="h-4 w-4" />
                {t("common:installApp")}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="justify-start text-muted-foreground"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              {t("common:signOut")}
            </Button>
          </div>
        </div>
      </SheetContent>

      <Dialog open={signOutConfirmOpen} onOpenChange={setSignOutConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("common:unsavedTitle")}</DialogTitle>
            <DialogDescription>
              {t("common:unsavedDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setSignOutConfirmOpen(false)}
            >
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
