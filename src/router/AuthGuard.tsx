import { useEffect, useRef, useState } from "react"
import { useAtomValue } from "jotai"
import { Navigate, Outlet } from "react-router-dom"
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

export function AuthGuard() {
  const user = useAtomValue(authAtom)
  const authLoading = useAtomValue(authLoadingAtom)
  const prevUserRef = useRef(user)
  const [showDialog, setShowDialog] = useState(false)
  const { permissionGranted, requestPermission } = useNotificationPermission()

  useEffect(() => {
    const wasNull = prevUserRef.current === null
    prevUserRef.current = user

    if (wasNull && user && !permissionGranted) {
      setShowDialog(true)
    }
  }, [user, permissionGranted])

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
            <DialogTitle>Enable Notifications</DialogTitle>
            <DialogDescription>
              Notifications are needed for rest timer alerts when the app is in
              the background. You can change this later in your browser settings.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={handleDismiss}>
              Not now
            </Button>
            <Button onClick={handleEnable}>Enable Notifications</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
