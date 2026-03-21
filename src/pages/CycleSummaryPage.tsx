import { useParams, useNavigate, Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import {
  Trophy,
  Calendar,
  Clock,
  Dumbbell,
  Weight,
  Flame,
  CalendarCheck,
  Loader2,
  ArrowLeft,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useCycleStats } from "@/hooks/useCycleStats"
import { usePreviousCycle } from "@/hooks/usePreviousCycle"
import { useFinishCycle } from "@/hooks/useFinishCycle"
import { useCycleProgress } from "@/hooks/useCycle"
import { useWorkoutDays } from "@/hooks/useWorkoutDays"
import { formatDate } from "@/lib/formatters"
import { StatCard } from "@/components/cycle-summary/StatCard"
import { Button } from "@/components/ui/button"
import type { Cycle } from "@/types/database"

function formatMs(ms: number): string {
  const totalMin = Math.round(ms / 60_000)
  if (totalMin < 60) return `${totalMin}m`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`
}

export function CycleSummaryPage() {
  const { cycleId } = useParams<{ cycleId: string }>()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation("workout")
  const finishCycle = useFinishCycle()

  const { data: cycle, isLoading: cycleLoading } = useQuery<Cycle | null>({
    queryKey: ["cycle", cycleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cycles")
        .select("*")
        .eq("id", cycleId!)
        .single()
      if (error?.code === "PGRST116") return null
      if (error) throw error
      return data
    },
    enabled: !!cycleId,
  })

  const programId = cycle?.program_id ?? null
  const { data: previousCycle } = usePreviousCycle(programId, cycleId ?? null)
  const { data: stats, isLoading: statsLoading } = useCycleStats(
    cycleId ?? null,
    previousCycle?.id,
  )
  const { data: days } = useWorkoutDays(programId)
  const cycleProgress = useCycleProgress(cycleId ?? null, days ?? [])

  const isLoading = cycleLoading || statsLoading

  async function handleStartNewCycle() {
    if (!cycleId) return
    await finishCycle.mutateAsync(cycleId)
    navigate("/")
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!cycle || !stats) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <Trophy className="h-16 w-16 text-muted-foreground/50" />
        <h2 className="text-xl font-bold">{t("cycleSummary.notFound")}</h2>
        <Button variant="outline" asChild>
          <Link to="/">{t("cycleSummary.backToWorkouts")}</Link>
        </Button>
      </div>
    )
  }

  const locale = i18n.language
  const dateRange = [
    formatDate(stats.started_at, locale, { month: "short", day: "numeric" }),
    stats.last_finished_at
      ? formatDate(stats.last_finished_at, locale, { month: "short", day: "numeric" })
      : "…",
  ].join(" → ")

  const sessionLabel = `${stats.session_count}/${cycleProgress.totalDays}`
  const volumeLabel = `${Math.round(stats.total_volume_kg).toLocaleString(locale)} kg`

  return (
    <div className="flex flex-1 flex-col items-center gap-6 px-6 py-8">
      {/* Hero */}
      <Trophy className="h-16 w-16 text-primary" />
      <div className="text-center">
        <h1 className="text-2xl font-bold">{t("cycleSummary.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("cycleSummary.subtitle")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{dateRange}</p>
      </div>

      {/* Stats grid */}
      <div className="grid w-full max-w-sm grid-cols-2 gap-3">
        <StatCard
          icon={Calendar}
          value={sessionLabel}
          label={t("cycleSummary.sessions")}
        />
        <StatCard
          icon={Clock}
          value={formatMs(stats.total_duration_ms)}
          label={t("cycleSummary.duration")}
        />
        <StatCard
          icon={Dumbbell}
          value={stats.total_sets}
          label={t("cycleSummary.sets")}
          delta={stats.delta_sets_pct}
        />
        <StatCard
          icon={Weight}
          value={volumeLabel}
          label={t("cycleSummary.volume")}
          delta={stats.delta_volume_pct}
        />
        <StatCard
          icon={Flame}
          value={stats.pr_count}
          label={t("cycleSummary.prs")}
          delta={stats.delta_prs_pct}
        />
        <StatCard
          icon={CalendarCheck}
          value={`${stats.duration_days} ${t("cycleSummary.days")}`}
          label={t("cycleSummary.consistency")}
        />
      </div>

      {/* Comparison callout */}
      <p className="text-xs text-muted-foreground">
        {previousCycle
          ? t("cycleSummary.vsPrevious")
          : t("cycleSummary.firstCycle")}
      </p>

      {/* CTAs */}
      <div className="flex w-full max-w-sm flex-col gap-3 pt-2">
        <Button
          size="lg"
          className="w-full"
          onClick={handleStartNewCycle}
          disabled={finishCycle.isPending}
        >
          {t("cycleSummary.startNewCycle")}
        </Button>
        <Button variant="ghost" size="sm" className="gap-2" asChild>
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            {t("cycleSummary.backToWorkouts")}
          </Link>
        </Button>
      </div>
    </div>
  )
}
