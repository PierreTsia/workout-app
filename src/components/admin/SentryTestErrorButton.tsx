import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"

/** Throws on click — for verifying Sentry from the admin-only /admin page. */
export function SentryTestErrorButton() {
  const { t } = useTranslation("admin")

  return (
    <Button
      type="button"
      variant="destructive"
      onClick={() => {
        throw new Error("This is your first error!")
      }}
    >
      {t("sentryTest.button")}
    </Button>
  )
}
