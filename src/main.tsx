import "@/lib/i18n"
import "react-day-picker/style.css"
import "@/styles/globals.css"
import "@/lib/supabase"

import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ThemeProvider } from "next-themes"
import { QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "react-router-dom"
import { router } from "@/router"
import { queryClient } from "@/lib/queryClient"
import { initSyncListeners } from "@/lib/syncService"
import { Toaster } from "@/components/ui/sonner"
import { ErrorFallback } from "@/components/ErrorFallback"
import { AppErrorBoundary } from "@/components/AppErrorBoundary"
import { prepareThemeLocalStorage, THEME_STORAGE_KEY } from "@/lib/themeStorage"
import { handleVersionUpgrade } from "@/lib/versionManager"
import { Analytics } from "@vercel/analytics/react"

// Defer work that doesn't need to run before first paint:
//   - Sentry SDK init (dynamic import keeps it out of the main bundle)
//   - PWA service-worker registration
// Trade-off: errors fired in the first ~2s of boot may be missed.
const runWhenIdle = (cb: () => void) => {
  if (typeof window === "undefined") return
  const w = window as Window & {
    requestIdleCallback?: (
      cb: () => void,
      opts?: { timeout?: number },
    ) => number
  }
  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(cb, { timeout: 2000 })
  } else {
    setTimeout(cb, 500)
  }
}

handleVersionUpgrade()
  .catch((error) => {
    console.error("Version upgrade failed; continuing app boot.", error)
  })
  .finally(() => {
    initSyncListeners()
    prepareThemeLocalStorage(localStorage)

    const app = (
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        storageKey={THEME_STORAGE_KEY}
        themes={["light", "dark", "system"]}
      >
        <QueryClientProvider client={queryClient}>
          <AppErrorBoundary
            fallback={({ error, resetError }) => (
              <ErrorFallback
                error={error}
                resetErrorBoundary={resetError}
                variant="page"
              />
            )}
          >
            <RouterProvider router={router} />
          </AppErrorBoundary>
          <Toaster />
          <Analytics />
        </QueryClientProvider>
      </ThemeProvider>
    )

    createRoot(document.getElementById("root")!).render(
      <StrictMode>{app}</StrictMode>,
    )

    runWhenIdle(() => {
      void import("@/lib/sentry")
        .then(({ initSentry }) => initSentry())
        .catch(() => {})

      void import("@/lib/swReloadOnUpdate")
        .then(({ listenForSwUpdate }) => listenForSwUpdate())
        .catch(() => {})
    })
  })
