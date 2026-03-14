import "@/lib/i18n"
import "@/styles/globals.css"
import "@/lib/supabase"

import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ThemeProvider } from "next-themes"
import { QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "react-router-dom"
import { ErrorBoundary } from "react-error-boundary"
import { router } from "@/router"
import { queryClient } from "@/lib/queryClient"
import { initSyncListeners } from "@/lib/syncService"
import { Toaster } from "@/components/ui/sonner"
import { ErrorFallback } from "@/components/ErrorFallback"

initSyncListeners()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary
          fallbackRender={({ error, resetErrorBoundary }) => (
            <ErrorFallback
              error={
                error instanceof Error
                  ? error
                  : new Error(String(error))
              }
              resetErrorBoundary={resetErrorBoundary}
              variant="page"
            />
          )}
        >
          <RouterProvider router={router} />
        </ErrorBoundary>
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
