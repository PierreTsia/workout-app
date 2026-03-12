import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StatsDashboard } from "@/components/history/StatsDashboard"
import { SessionList } from "@/components/history/SessionList"
import { ExerciseTab } from "@/components/history/ExerciseTab"

export function HistoryPage() {
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
          aria-label="Back to workout"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">History</h1>
      </div>

      <StatsDashboard />

      <Tabs defaultValue="sessions">
        <TabsList className="w-full">
          <TabsTrigger value="sessions" className="flex-1">
            Sessions
          </TabsTrigger>
          <TabsTrigger value="by-exercise" className="flex-1">
            By Exercise
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="mt-3">
          <SessionList />
        </TabsContent>

        <TabsContent value="by-exercise" className="mt-3">
          <ExerciseTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
