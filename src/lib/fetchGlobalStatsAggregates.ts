import type { SupabaseClient } from "@supabase/supabase-js"

export interface StatsAggregates {
  totalSessions: number
  totalSets: number
  totalPRs: number
}

/** Single source of truth for StatsDashboard “all time” counts (RLS applies). */
export async function fetchGlobalStatsAggregates(client: SupabaseClient): Promise<StatsAggregates> {
  const [sessionsRes, setsRes, prsRes] = await Promise.all([
    client
      .from("sessions")
      .select("*", { count: "exact", head: true })
      .not("finished_at", "is", null),
    client.from("set_logs").select("*", { count: "exact", head: true }),
    client.from("set_logs").select("*", { count: "exact", head: true }).eq("was_pr", true),
  ])

  if (sessionsRes.error) throw sessionsRes.error
  if (setsRes.error) throw setsRes.error
  if (prsRes.error) throw prsRes.error

  return {
    totalSessions: sessionsRes.count ?? 0,
    totalSets: setsRes.count ?? 0,
    totalPRs: prsRes.count ?? 0,
  }
}
