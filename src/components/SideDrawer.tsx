import { useEffect, useState } from "react"
import { useAtom, useAtomValue } from "jotai"
import { Link } from "react-router-dom"
import { useTheme } from "next-themes"
import { useTranslation } from "react-i18next"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
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
import { LogOut, Download, Info, Shield, RefreshCw } from "lucide-react"
import {
  authAtom,
  drawerOpenAtom,
  localeAtom,
  queueSyncMetaAtom,
  themeAtom,
  weightUnitAtom,
} from "@/store/atoms"
import { supabase } from "@/lib/supabase"
import { useInstallPrompt } from "@/hooks/useInstallPrompt"
import { AdminOnly } from "@/components/admin/AdminOnly"

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
  const { t, i18n } = useTranslation(["common", "settings"])
  const [open, setOpen] = useAtom(drawerOpenAtom)
  const [currentTheme, setThemeAtom] = useAtom(themeAtom)
  const [locale, setLocale] = useAtom(localeAtom)
  const [weightUnit, setWeightUnit] = useAtom(weightUnitAtom)
  const user = useAtomValue(authAtom)
  const queueMeta = useAtomValue(queueSyncMetaAtom)
  const { setTheme } = useTheme()
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false)
  const { canInstall, isInstalled, promptInstall } = useInstallPrompt()

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

  function toggleTheme() {
    const next = currentTheme === "dark" ? "light" : "dark"
    setTheme(next)
    setThemeAtom(next)
  }

  function handleLocaleChange(v: "en" | "fr") {
    setLocale(v)
    i18n.changeLanguage(v)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" className="w-72 bg-card">
        <SheetHeader>
          <SheetTitle className="text-foreground">{t("common:menu")}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-2 py-4">
          <div className="flex items-center gap-3 px-2 pb-4">
            <Avatar>
              <AvatarImage
                src={user?.user_metadata?.avatar_url}
                alt={user?.user_metadata?.full_name ?? ""}
                referrerPolicy="no-referrer"
              />
              <AvatarFallback>👤</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">
                {user?.user_metadata?.full_name ?? t("common:guest")}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user?.email ?? t("common:notSignedIn")}
              </p>
            </div>
          </div>

          <Separator />

          <nav className="flex flex-col gap-1 py-2">
            <Button variant="ghost" className="justify-start" asChild>
              <Link to="/history" onClick={closeDrawer}>
                {t("common:history")}
              </Link>
            </Button>
            <Button variant="ghost" className="justify-start" asChild>
              <Link to="/builder" onClick={closeDrawer}>
                {t("common:workoutBuilder")}
              </Link>
            </Button>
            <Button variant="ghost" className="justify-start" asChild>
              <Link to="/change-program" onClick={closeDrawer}>
                <RefreshCw className="h-4 w-4" />
                {t("common:changeProgram")}
              </Link>
            </Button>
            <AdminOnly>
              <Button variant="ghost" className="justify-start" asChild>
                <Link to="/admin/exercises" onClick={closeDrawer}>
                  <Shield className="h-4 w-4" />
                  {t("common:admin")}
                </Link>
              </Button>
            </AdminOnly>
          </nav>

          <Separator />

          <div className="flex flex-col gap-3 px-2 py-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">{t("common:darkMode")}</span>
              <Switch
                checked={currentTheme === "dark"}
                onCheckedChange={toggleTheme}
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

            {!isInstalled && (
              <Button
                variant="ghost"
                size="sm"
                className="justify-start text-muted-foreground"
                disabled={!canInstall}
                onClick={promptInstall}
              >
                <Download className="h-4 w-4" />
                {canInstall ? t("common:installApp") : t("common:installAppBrowser")}
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
    </Sheet>
  )
}
