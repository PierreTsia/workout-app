import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { SentryTestErrorButton } from "@/components/admin/SentryTestErrorButton"

export function AdminHomePage() {
  const { t } = useTranslation(["admin", "common"])

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("homeDescription")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/exercises">{t("common:adminExercises")}</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/review">{t("review.navLabel")}</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/enrichment">{t("enrichment.navLabel")}</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/feedback">{t("common:adminFeedback")}</Link>
        </Button>
      </div>

      <section
        className="rounded-lg border border-border/80 border-dashed bg-muted/30 p-4"
        aria-labelledby="admin-sentry-test-heading"
      >
        <h2
          id="admin-sentry-test-heading"
          className="text-sm font-semibold text-foreground"
        >
          {t("sentryTest.heading")}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("sentryTest.hint")}
        </p>
        <div className="mt-3">
          <SentryTestErrorButton />
        </div>
      </section>
    </div>
  )
}
