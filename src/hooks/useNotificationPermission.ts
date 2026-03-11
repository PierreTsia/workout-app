import { useState, useCallback } from "react"

const STORAGE_KEY = "notification_permission_granted"

function isSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window
}

function readGranted(): boolean {
  if (!isSupported()) return false
  return Notification.permission === "granted"
}

export function useNotificationPermission() {
  const [permissionGranted, setPermissionGranted] = useState(readGranted)

  const requestPermission = useCallback(async () => {
    if (!isSupported()) return

    const result = await Notification.requestPermission()
    const granted = result === "granted"
    setPermissionGranted(granted)
    localStorage.setItem(STORAGE_KEY, String(granted))
  }, [])

  return { permissionGranted, requestPermission } as const
}
