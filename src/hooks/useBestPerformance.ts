import {
  useQuery,
  type QueryClient,
} from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import { getSessionRealId } from "@/lib/syncService"
import {
  getPrModality,
  scoreSetLogRow,
  type PrModality,
} from "@/lib/prDetection"

export type BestPerformanceSnapshot = {
  bestValue: number
  hasPriorSession: boolean
  modality: PrModality
}

export type UseBestPerformanceArgs = {
  exerciseId: string | undefined
  localSessionId: string
  sessionStartedAtMs: number | null | undefined
  measurementType: "reps" | "duration" | undefined
  equipment: string | undefined
}

type SessionEmbed = { started_at: string; finished_at: string | null }

type SetLogWithSession = {
  reps_logged: string | null
  weight_logged: number
  estimated_1rm: number | null
  duration_seconds: number | null
  session_id: string
  sessions: SessionEmbed | SessionEmbed[] | null
}

function normalizeSessionEmbed(
  s: SetLogWithSession["sessions"],
): SessionEmbed | null {
  if (!s) return null
  return Array.isArray(s) ? (s[0] ?? null) : s
}

export function bestPerformanceQueryKey(
  userId: string,
  args: UseBestPerformanceArgs,
) {
  const mt = args.measurementType ?? "reps"
  const eq = args.equipment ?? ""
  return [
    "best-performance",
    userId,
    args.exerciseId,
    args.localSessionId,
    mt,
    eq,
    args.sessionStartedAtMs ?? 0,
  ] as const
}

export async function fetchBestPerformance(
  userId: string,
  args: UseBestPerformanceArgs,
): Promise<BestPerformanceSnapshot> {
  if (!args.exerciseId || args.localSessionId === "no-session") {
    return {
      bestValue: 0,
      hasPriorSession: false,
      modality: getPrModality({
        measurement_type: args.measurementType ?? "reps",
        equipment: args.equipment,
      }),
    }
  }

  const modality = getPrModality({
    measurement_type: args.measurementType ?? "reps",
    equipment: args.equipment,
  })

  const realId = getSessionRealId(userId, args.localSessionId)

  const { data: sessionRow, error: sessionErr } = await supabase
    .from("sessions")
    .select("started_at")
    .eq("id", realId)
    .maybeSingle()

  if (sessionErr) throw sessionErr

  const currentStartMs = sessionRow?.started_at
    ? new Date(sessionRow.started_at).getTime()
    : args.sessionStartedAtMs ?? null

  if (currentStartMs == null) {
    return { bestValue: 0, hasPriorSession: false, modality }
  }

  const { data: rawLogs, error } = await supabase
    .from("set_logs")
    .select(
      "reps_logged, weight_logged, estimated_1rm, duration_seconds, session_id, sessions(started_at, finished_at)",
    )
    .eq("exercise_id", args.exerciseId)

  if (error) throw error

  const logs = (rawLogs ?? []) as SetLogWithSession[]

  const priorSessionRows = logs.filter((r) => {
    if (r.session_id === realId) return false
    const sess = normalizeSessionEmbed(r.sessions)
    if (!sess?.finished_at || !sess.started_at) return false
    return new Date(sess.started_at).getTime() < currentStartMs
  })

  const bestValue = priorSessionRows.reduce((max, r) => {
    const s = scoreSetLogRow(r, modality)
    return Math.max(max, s)
  }, 0)

  const hasPriorSession = priorSessionRows.length > 0

  return { bestValue, hasPriorSession, modality }
}

export function prefetchBestPerformance(
  queryClient: QueryClient,
  userId: string,
  args: UseBestPerformanceArgs,
) {
  if (!args.exerciseId || args.localSessionId === "no-session") {
    return Promise.resolve()
  }
  return queryClient.prefetchQuery({
    queryKey: bestPerformanceQueryKey(userId, args),
    queryFn: () => fetchBestPerformance(userId, args),
  })
}

export function useBestPerformance(args: UseBestPerformanceArgs) {
  const user = useAtomValue(authAtom)
  const userId = user?.id

  return useQuery({
    queryKey: userId
      ? bestPerformanceQueryKey(userId, args)
      : ["best-performance", "disabled"],
    queryFn: () => fetchBestPerformance(userId!, args),
    enabled:
      !!userId &&
      !!args.exerciseId &&
      args.localSessionId !== "no-session",
  })
}
