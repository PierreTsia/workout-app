let reloading = false

const UPDATE_CHECK_INTERVAL_MS = 10 * 60 * 1000 // 10 minutes

/**
 * When a new service worker takes control (after `skipWaiting` + `clients.claim`),
 * reload the page so the user gets fresh assets instead of running old JS against new data.
 *
 * Also polls for SW updates every 10 minutes so the user doesn't have to
 * close/reopen the app to pick up a deploy.
 */
export function listenForSwUpdate() {
  if (!("serviceWorker" in navigator)) return

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return
    reloading = true
    window.location.reload()
  })

  navigator.serviceWorker.ready.then((registration) => {
    setInterval(() => {
      registration.update()
    }, UPDATE_CHECK_INTERVAL_MS)
  })
}
