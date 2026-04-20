import { registerSW } from "virtual:pwa-register"

const UPDATE_CHECK_INTERVAL_MS = 10 * 60 * 1000 // 10 minutes

let reloading = false

/**
 * Register the service worker via vite-plugin-pwa's virtual module,
 * poll for updates every 10 minutes, and reload the page when a new
 * SW takes control so the user always runs fresh assets.
 */
export function listenForSwUpdate() {
  if (!("serviceWorker" in navigator)) return

  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return
      reloading = true
      window.location.reload()
    })
  }

  registerSW({
    // `immediate: false` waits for the `load` event before registering the
    // SW, which keeps the browser's main thread free during initial paint.
    // `handleVersionUpgrade` (main.tsx) still forces a reload on version
    // mismatch, so end users continue to get the new build on update.
    immediate: false,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      setInterval(() => {
        registration.update().catch(() => {})
      }, UPDATE_CHECK_INTERVAL_MS)
    },
    onRegisterError(error) {
      console.warn("SW registration failed:", error)
    },
  })
}
