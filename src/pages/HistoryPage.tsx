import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StatsDashboard } from "@/components/history/StatsDashboard"
import { SessionList } from "@/components/history/SessionList"
import { ExerciseTab } from "@/components/history/ExerciseTab"
import { ActivityTab } from "@/components/history/ActivityTab"
import { BalanceTab } from "@/components/history/balance/BalanceTab"

export function HistoryPage() {
  const { t } = useTranslation("history")
  const navigate = useNavigate()

  useEffect(() => {
    history.pushState(null, "", location.href)

    function handlePopState() {
      navigate("/", { replace: true })
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [navigate])

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
        <h1 className="text-xl font-bold">{t("history")}</h1>
      </div>

      <StatsDashboard />

      <Tabs defaultValue="activity">
        <TabsList className="grid h-auto w-full grid-cols-2 grid-rows-2 gap-1 items-stretch p-1 sm:inline-flex sm:h-10 sm:grid-cols-none sm:grid-rows-none sm:items-center sm:justify-center">
          <TabsTrigger
            value="activity"
            className="w-full px-2 py-2 text-xs sm:flex-1 sm:py-1.5 sm:text-sm"
          >
            {t("activity")}
          </TabsTrigger>
          <TabsTrigger
            value="sessions"
            className="w-full px-2 py-2 text-xs sm:flex-1 sm:py-1.5 sm:text-sm"
          >
            {t("sessions")}
          </TabsTrigger>
          <TabsTrigger
            value="by-exercise"
            className="w-full px-2 py-2 text-xs sm:flex-1 sm:py-1.5 sm:text-sm"
          >
            {t("byExercise")}
          </TabsTrigger>
          <TabsTrigger
            value="balance"
            className="w-full px-2 py-2 text-xs sm:flex-1 sm:py-1.5 sm:text-sm"
          >
            {t("balance.tab")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="mt-3">
          <ActivityTab />
        </TabsContent>

        <TabsContent value="sessions" className="mt-3">
          <SessionList />
        </TabsContent>

        <TabsContent value="by-exercise" className="mt-3">
          <ExerciseTab />
        </TabsContent>

        <TabsContent value="balance" className="mt-3">
          <BalanceTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
