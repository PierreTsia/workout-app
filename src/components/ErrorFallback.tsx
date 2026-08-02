import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { AlertTriangle, ChevronDown, ChevronUp, Copy } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { copyToClipboard } from "@/lib/clipboard"
import {
  buildErrorReport,
  formatReportAsMarkdown,
  makeErrorId,
} from "@/lib/errorReport"

interface ErrorFallbackProps {
  error: Error
  errorId?: string
  componentStack?: string | null
  caughtAt?: Date
  resetErrorBoundary?: () => void
  variant?: "page" | "inline"
}

export function ErrorFallback({
  error,
  errorId,
  componentStack,
  caughtAt,
  resetErrorBoundary,
  variant = "page",
}: ErrorFallbackProps) {
  const { t } = useTranslation("error")
  const [showDetails, setShowDetails] = useState(false)

  // Pin the report timestamp to the moment the boundary caught (when
  // available) or the first render of this fallback. Without this, every
  // re-render — e.g. toggling details — would mint a fresh `Date`, making
  // the report non-deterministic and the timestamp ≠ crash time.
  const pinnedNow = useMemo(() => caughtAt ?? new Date(), [caughtAt])

  const resolvedId = errorId ?? makeErrorId(error)
  const report = buildErrorReport({
    id: resolvedId,
    error,
    componentStack: componentStack ?? null,
    now: pinnedNow,
  })

  const handleCopy = async () => {
    const ok = await copyToClipboard(formatReportAsMarkdown(report))
    if (ok) toast.success(t("copyReportSuccess"))
    else toast.error(t("copyReportFailure"))
  }

  const errorIdBadge = (
    <div className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-2 py-1 font-mono text-xs">
      <span className="text-muted-foreground">{t("errorIdLabel")}:</span>
      <span className="text-foreground">{resolvedId}</span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 gap-1 px-2 text-xs"
        onClick={handleCopy}
      >
        <Copy className="h-3 w-3" />
        {t("copyReport")}
      </Button>
    </div>
  )

  const detailsToggle = (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setShowDetails((v) => !v)}
      aria-expanded={showDetails}
      className="w-full justify-center text-xs text-muted-foreground hover:text-foreground"
    >
      {t("details")}
      {showDetails ? (
        <ChevronUp className="ml-1 h-3 w-3" />
      ) : (
        <ChevronDown className="ml-1 h-3 w-3" />
      )}
    </Button>
  )

  const detailsBlock = showDetails && (
    <div className="mt-2 space-y-2">
      <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-3 text-left text-xs text-muted-foreground">
        <span className="block font-semibold text-foreground/70">
          {t("stackTrace")}
        </span>
        {error.stack ?? error.message}
      </pre>
      {report.componentStack && (
        <pre className="max-h-32 overflow-auto rounded-lg bg-muted p-3 text-left text-xs text-muted-foreground">
          <span className="block font-semibold text-foreground/70">
            {t("componentStack")}
          </span>
          {report.componentStack}
        </pre>
      )}
    </div>
  )

  if (variant === "inline") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
        <AlertTriangle className="h-6 w-6 text-destructive" />
        <p className="text-sm text-muted-foreground">{t("title")}</p>
        <p className="max-w-full break-words text-xs text-muted-foreground/80">
          {error.message}
        </p>
        {errorIdBadge}
        {resetErrorBoundary && (
          <Button variant="outline" size="sm" onClick={resetErrorBoundary}>
            {t("retry")}
          </Button>
        )}
        <div className="w-full">
          {detailsToggle}
          {detailsBlock}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {t("description")}
        </p>
        {errorIdBadge}
        <p className="max-w-md break-words text-xs text-muted-foreground/80">
          {error.message}
        </p>
      </div>

      <div className="flex gap-3">
        {resetErrorBoundary && (
          <Button onClick={resetErrorBoundary}>{t("retry")}</Button>
        )}
        <Button variant="outline" asChild>
          <a href="/">{t("goHome")}</a>
        </Button>
      </div>

      <div className="w-full max-w-lg">
        {detailsToggle}
        {detailsBlock}
      </div>
    </div>
  )
}
