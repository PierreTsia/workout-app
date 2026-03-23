import { useEffect, useRef, useState } from "react"
import { useAtomValue } from "jotai"
import { useTranslation } from "react-i18next"
import { Navigate, Outlet } from "react-router-dom"
import type { User } from "@/types/auth"
import { authAtom, authLoadingAtom } from "@/store/atoms"
import { useNotificationPermission } from "@/hooks/useNotificationPermission"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

/** Set by LoginPage before OAuth redirect; cleared on first AuthGuard auth baseline. */
const NOTIFICATION_OAUTH_FLAG = "notification_prompt_after_oauth"

function scheduleShowNotificationDialog(setter: (open: boolean) => void) {
  queueMicrotask(() => setter(true))
}

export function AuthGuard() {
  const { t } = useTranslation("auth")
  const user = useAtomValue(authAtom)
  const authLoading = useAtomValue(authLoadingAtom)
  const [showDialog, setShowDialog] = useState(false)
  const { permissionGranted, requestPermission } = useNotificationPermission()
  const prevUserRef = useRef<User | null>(null)
  const authBaselineDoneRef = useRef(false)

  // First auth resolution after mount: establish baseline without dialog. Session restore
  // on refresh looks like null → user elsewhere; this avoids that false positive.
  // OAuth sign-in also full-reloads the app; LoginPage sets sessionStorage so we still prompt once.
  useEffect(() => {
    if (authLoading) return
    if (!authBaselineDoneRef.current) {
      authBaselineDoneRef.current = true
      prevUserRef.current = user
      const oauthPending =
        sessionStorage.getItem(NOTIFICATION_OAUTH_FLAG) === "1"
      sessionStorage.removeItem(NOTIFICATION_OAUTH_FLAG)
      if (oauthPending && user && !permissionGranted) {
        scheduleShowNotificationDialog(setShowDialog)
      }
      return
    }
    if (prevUserRef.current === null && user !== null && !permissionGranted) {
      scheduleShowNotificationDialog(setShowDialog)
    }
    prevUserRef.current = user
  }, [authLoading, user, permissionGranted])

  if (authLoading) {
    return null
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const handleEnable = async () => {
    await requestPermission()
    setShowDialog(false)
  }

  const handleDismiss = () => {
    setShowDialog(false)
  }

  return (
    <>
      <Outlet />
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{t("notificationDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("notificationDialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={handleDismiss}>
              {t("notificationNotNow")}
            </Button>
            <Button onClick={handleEnable}>{t("notificationEnable")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
