import { useAtomValue, useSetAtom } from "jotai"
import { useLocation, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { sessionAtom, finishRequestAtom } from "@/store/atoms"
import { Button } from "@/components/ui/button"

/**
 * Persistent finish control in the `AppShell` header (#571). Visible whenever a
 * session is active — including inside a circuit, where the bottom `SessionNav`
 * is not rendered. From another route it navigates home first, then bumps
 * `finishRequestAtom`; `WorkoutPage` runs the shared finish attempt.
 */
export function FinishSessionButton() {
  const { t } = useTranslation("workout")
  const session = useAtomValue(sessionAtom)
  const setFinishRequest = useSetAtom(finishRequestAtom)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  if (!session.isActive) return null

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 rounded-full px-3 text-xs"
      onClick={() => {
        if (pathname !== "/") navigate("/")
        setFinishRequest((n) => n + 1)
      }}
    >
      {t("finish")}
    </Button>
  )
}
