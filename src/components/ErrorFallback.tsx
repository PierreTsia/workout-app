import { useState } from "react"
import { useTranslation } from "react-i18next"
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ErrorFallbackProps {
  error: Error
  resetErrorBoundary?: () => void
  variant?: "page" | "inline"
}

export function ErrorFallback({
  error,
  resetErrorBoundary,
  variant = "page",
}: ErrorFallbackProps) {
  const { t } = useTranslation("error")
  const [showDetails, setShowDetails] = useState(false)
  const isDev = import.meta.env.DEV

  if (variant === "inline") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
        <AlertTriangle className="h-6 w-6 text-destructive" />
        <p className="text-sm text-muted-foreground">{t("title")}</p>
        {resetErrorBoundary && (
          <Button variant="outline" size="sm" onClick={resetErrorBoundary}>
            {t("retry")}
          </Button>
        )}
        {isDev && (
          <pre className="mt-2 max-w-full overflow-auto rounded bg-muted p-2 text-left text-xs text-muted-foreground">
            {error.message}
          </pre>
        )}
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
      </div>

      <div className="flex gap-3">
        {resetErrorBoundary && (
          <Button onClick={resetErrorBoundary}>{t("retry")}</Button>
        )}
        <Button variant="outline" asChild>
          <a href="/">{t("goHome")}</a>
        </Button>
      </div>

      {isDev && (
        <div className="w-full max-w-lg">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails((v) => !v)}
            aria-expanded={showDetails}
            className="w-full text-xs text-muted-foreground hover:text-foreground"
          >
            {t("details")}
            {showDetails ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </Button>
          {showDetails && (
            <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-muted p-4 text-left text-xs text-muted-foreground">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
