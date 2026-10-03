import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Heading,
  Text,
} from "@nomosui/react"
import { SentryTestErrorButton } from "@/components/admin/SentryTestErrorButton"

export function AdminHomePage() {
  const { t } = useTranslation(["admin", "common"])

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <div>
        <Heading level={1}>{t("title")}</Heading>
        <Text size="body" className="text-muted-foreground">
          {t("homeDescription")}
        </Text>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/exercises">{t("common:adminExercises")}</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/review">{t("review.navLabel")}</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/translations">{t("translations.navLabel")}</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/enrichment">{t("enrichment.navLabel")}</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/feedback">{t("common:adminFeedback")}</Link>
        </Button>
      </div>

      <Card
        role="region"
        aria-labelledby="admin-sentry-test-heading"
        className="border-dashed bg-muted/30 p-4"
      >
        <CardHeader className="p-0">
          <CardTitle
            id="admin-sentry-test-heading"
            className="text-sm font-semibold text-foreground"
          >
            {t("sentryTest.heading")}
          </CardTitle>
          <CardDescription className="text-xs">
            {t("sentryTest.hint")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 pt-3">
          <SentryTestErrorButton />
        </CardContent>
      </Card>
    </div>
  )
}
