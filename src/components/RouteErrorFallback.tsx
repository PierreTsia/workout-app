import { useNavigate, useRouteError, isRouteErrorResponse } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

export function RouteErrorFallback() {
  const error = useRouteError()
  const navigate = useNavigate()
  const { t } = useTranslation("error")
  const isDev = import.meta.env.DEV

  const goHome = () => navigate("/", { replace: true })

  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="text-5xl">🔍</span>
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
