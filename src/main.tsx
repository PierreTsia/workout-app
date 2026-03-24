import "@/lib/i18n"
import "react-day-picker/style.css"
import "@/styles/globals.css"
import "@/lib/supabase"

import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ThemeProvider } from "next-themes"
import { QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "react-router-dom"
import { ErrorBoundary } from "@sentry/react"
import { router } from "@/router"
import { queryClient } from "@/lib/queryClient"
import { initSyncListeners } from "@/lib/syncService"
import { Toaster } from "@/components/ui/sonner"
import { ErrorFallback } from "@/components/ErrorFallback"
import { prepareThemeLocalStorage, THEME_STORAGE_KEY } from "@/lib/themeStorage"
import { handleVersionUpgrade } from "@/lib/versionManager"
import { listenForSwUpdate } from "@/lib/swReloadOnUpdate"
import { Analytics } from "@vercel/analytics/react"
import { initSentry } from "@/lib/sentry"

initSentry()
listenForSwUpdate()

// Purge stale caches/localStorage before React mounts so Jotai atoms read clean values.
handleVersionUpgrade()
  .catch((error) => {
    console.error("Version upgrade failed; continuing app boot.", error)
  })
  .finally(() => {
    initSyncListeners()
    prepareThemeLocalStorage(localStorage)

    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          storageKey={THEME_STORAGE_KEY}
          themes={["light", "dark", "system"]}
        >
          <QueryClientProvider client={queryClient}>
            <ErrorBoundary
              fallback={({ error, resetError }) => (
                <ErrorFallback
                  error={
                    error instanceof Error
                      ? error
                      : new Error(String(error))
                  }
                  resetErrorBoundary={resetError}
                  variant="page"
                />
              )}
              showDialog={false}
            >
              <RouterProvider router={router} />
            </ErrorBoundary>
            <Toaster />
            <Analytics />
          </QueryClientProvider>
        </ThemeProvider>
      </StrictMode>,
    )
  })
