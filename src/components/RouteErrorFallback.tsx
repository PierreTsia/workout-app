import { useEffect, useRef } from "react"
import {
  useNavigate,
  useRouteError,
  isRouteErrorResponse,
} from "react-router-dom"
import { useTranslation } from "react-i18next"
import { AlertTriangle } from "lucide-react"
import { captureException } from "@sentry/react"
import { initSentry } from "@/lib/sentry"
import { Button } from "@/components/ui/button"

// React Router serves this element when an error throws during route
// rendering or — critically for #356 — when a `React.lazy` route's
// `import()` rejects (stale chunk hashes after a deploy → `index.html`
// served with `text/html` MIME type → "Failed to fetch dynamically
// imported module"). Without manual capture below, those crashes never
// reach Sentry because React Router swallows the throw and renders this
// fallback before it bubbles to `AppErrorBoundary`.
type RouteErrorKind =
  | "chunk_load_failed"
  | "route_error_response"
  | "unknown"

function isChunkLoadFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const message = error.message
  return (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("error loading dynamically imported module")
  )
}

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

  const is404 = isRouteErrorResponse(error) && error.status === 404

  useEffect(() => {
    // 404s aren't bugs — they're a real "not found" UX state. Capturing
    // them would turn signal into noise and pollute the Sentry dashboard
    // every time someone mistypes a URL.
    if (is404) return
    if (reportedRef.current) return
    reportedRef.current = true

    const kind = classifyRouteError(error)
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
  }, [error, is404])

  const goHome = () => navigate("/", { replace: true })

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
