import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ArrowLeft } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { MyWorkoutsTab } from "@/components/library/MyWorkoutsTab"
import { ProgramsTab } from "@/components/library/ProgramsTab"
import { QuickWorkoutTab } from "@/components/library/QuickWorkoutTab"

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

      <Tabs defaultValue="my-workouts">
        <TabsList className="w-full">
          <TabsTrigger value="my-workouts" className="flex-1">
            {t("tabMyWorkouts")}
          </TabsTrigger>
          <TabsTrigger value="programs" className="flex-1">
            {t("tabPrograms")}
          </TabsTrigger>
          <TabsTrigger value="quick-workout" className="flex-1 opacity-50 pointer-events-none" disabled>
            {t("tabQuickWorkout")}
            <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0">
              {t("comingSoon")}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-workouts" className="mt-3">
          <MyWorkoutsTab />
        </TabsContent>

        <TabsContent value="programs" className="mt-3">
          <ProgramsTab />
        </TabsContent>

        <TabsContent value="quick-workout" className="mt-3">
          <QuickWorkoutTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
