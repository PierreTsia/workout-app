import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ArrowLeft } from "lucide-react"
import { MyWorkoutsTab } from "@/components/library/MyWorkoutsTab"
import { SavedWorkoutsSection } from "@/components/library/SavedWorkoutsSection"

export function LibraryPage() {
  const { t } = useTranslation("library")
  const navigate = useNavigate()

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-8">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/")}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={t("backToWorkout")}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">{t("title")}</h1>
      </div>

      <SavedWorkoutsSection />
      <MyWorkoutsTab />
    </div>
  )
}
