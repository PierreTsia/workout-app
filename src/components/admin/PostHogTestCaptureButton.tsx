import { usePostHog } from "@posthog/react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

/** Sends a test capture — for verifying PostHog from the admin-only /admin page. */
export function PostHogTestCaptureButton() {
  const { t } = useTranslation("admin")
  const posthog = usePostHog()

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => {
        if (!posthog.__loaded) {
          toast.warning(t("posthogTest.notConfigured"))
          return
        }
        posthog.capture("posthog_admin_test", {
          button_name: "admin_overview",
          source: "admin",
        })
        toast.success(t("posthogTest.sent"))
      }}
    >
      {t("posthogTest.button")}
    </Button>
  )
}
