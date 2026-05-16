import { useEffect, useRef, useState } from "react"
import {
  useNavigate,
  useRouteError,
  isRouteErrorResponse,
} from "react-router-dom"
import { useTranslation } from "react-i18next"
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react"
import { captureException } from "@sentry/react"
import { initSentry } from "@/lib/sentry"
import {
  forceHardReload,
  isChunkLoadFailure,
} from "@/lib/lazyWithRecover"
import { Button } from "@/components/ui/button"

// React Router serves this element when an error throws during route
// rendering or — critically for #356 — when a `React.lazy` route's
// `import()` rejects (stale chunk hashes after a deploy → `index.html`
// served with `text/html` MIME type → "Failed to fetch dynamically
// imported module"). Without manual capture below, those crashes never
// reach Sentry because React Router swallows the throw and renders this
// fallback before it bubbles to `AppErrorBoundary`.
//
// `lazyWithRecover` already auto-reloads the page once on chunk-load
// failure, so by the time we land here in the `chunk_load_failed` branch
// the loop guard already tripped — meaning the soft reload didn't fix
// it. We surface a dedicated "Refresh now" UI that nukes caches +
// unregisters the SW (the only thing that can recover a poisoned SW
// precache) before reloading.
type RouteErrorKind =
  | "chunk_load_failed"
  | "route_error_response"
  | "unknown"

function classifyRouteError(error: unknown): RouteErrorKind {
  if (isChunkLoadFailure(error)) return "chunk_load_failed"
  if (isRouteErrorResponse(error)) return "route_error_response"
  return "unknown"
}

export function RouteErrorFallback() {
  const error = useRouteError()
  const navigate = useNavigate()
  const { t } = useTranslation("error")
  const isDev = import.meta.env.DEV
  const reportedRef = useRef(false)
  const [refreshing, setRefreshing] = useState(false)

  const is404 = isRouteErrorResponse(error) && error.status === 404
  const kind = classifyRouteError(error)
  const isStaleVersion = kind === "chunk_load_failed"

  useEffect(() => {
    // 404s aren't bugs — they're a real "not found" UX state. Capturing
    // them would turn signal into noise and pollute the Sentry dashboard
    // every time someone mistypes a URL.
    if (is404) return
    if (reportedRef.current) return
    reportedRef.current = true

    const exception =
      error instanceof Error
        ? error
        : new Error(
            typeof error === "string"
              ? error
              : `route ${kind} ${window.location.pathname}`,
          )

    try {
      initSentry()
      captureException(exception, {
        tags: {
          feature: "route-load",
          route: window.location.pathname,
          error_kind: kind,
        },
        extra: isRouteErrorResponse(error)
          ? {
              status: error.status,
              statusText: error.statusText,
              data: error.data,
            }
          : undefined,
      })
    } catch {
      // Defensive: capture should never throw, but we don't want to
      // crash the fallback UI on top of an already-failed render.
    }
  }, [error, is404, kind])

  const goHome = () => navigate("/", { replace: true })
  const handleForceRefresh = () => {
    setRefreshing(true)
    void forceHardReload()
  }

  if (is404) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="text-5xl" aria-hidden="true">🔍</span>
          <h1 className="text-2xl font-bold text-foreground">
            {t("notFoundTitle")}
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">
            {t("notFoundDescription")}
          </p>
        </div>
        <Button onClick={goHome}>{t("goHome")}</Button>
      </div>
    )
  }

  if (isStaleVersion) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <RefreshCw
            className="h-12 w-12 text-primary"
            aria-hidden="true"
          />
          <h1 className="text-2xl font-bold text-foreground">
            {t("staleVersionTitle")}
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">
            {t("staleVersionDescription")}
          </p>
        </div>
        <Button
          onClick={handleForceRefresh}
          disabled={refreshing}
          aria-busy={refreshing}
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : null}
          {t("forceRefresh")}
        </Button>
      </div>
    )
  }

  const normalizedError =
    error instanceof Error
      ? error
      : new Error(typeof error === "string" ? error : "Unknown error")

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {t("description")}
        </p>
      </div>

      <div className="flex gap-3">
        <Button onClick={() => navigate(0)}>{t("retry")}</Button>
        <Button variant="outline" onClick={goHome}>
          {t("goHome")}
        </Button>
      </div>

      {isDev && normalizedError.stack && (
        <pre className="max-h-64 w-full max-w-lg overflow-auto rounded-lg bg-muted p-4 text-xs text-muted-foreground">
          {normalizedError.message}
          {`\n\n${normalizedError.stack}`}
        </pre>
      )}
    </div>
  )
}
