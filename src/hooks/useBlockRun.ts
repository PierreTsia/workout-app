import { useCallback, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { authAtom } from "@/store/atoms"
import { supabase } from "@/lib/supabase"
import { templateFingerprint } from "@/lib/blockTemplate"
import {
  discardBlockRun,
  enqueueBlockRun,
  peekSessionRealId,
  queuedBlockRunFor,
  scheduleImmediateDrain,
} from "@/lib/syncService"
import type { ExerciseBlockWithExercises } from "@/types/database"

export interface UseBlockRun {
  startedAt: number | null
  finishedAt: number | null
  hydratePending: boolean
  stampGo: (at: number) => void
  stampFinish: (at: number) => void
  discardRun: () => Promise<void>
}

function parseRunRow(
  row: unknown,
): { startedAt: number; finishedAt: number | null } | null {
  if (row == null || typeof row !== "object") return null
  if (!("started_at" in row) || typeof row.started_at !== "string") return null
  const startedAt = Date.parse(row.started_at)
  if (Number.isNaN(startedAt)) return null
  const rawFinish = "finished_at" in row ? row.finished_at : null
  const finishedAt =
    typeof rawFinish === "string" ? Date.parse(rawFinish) : Number.NaN
  return {
    startedAt,
    finishedAt: Number.isNaN(finishedAt) ? null : finishedAt,
  }
}

export function useBlockRun(
  block: ExerciseBlockWithExercises,
  localSessionId: string,
): UseBlockRun {
  const userId = useAtomValue(authAtom)?.id ?? null
  const realId = userId ? peekSessionRealId(userId, localSessionId) : null
  const isAmrap = block.mode === "amrap"
  const queued = isAmrap ? queuedBlockRunFor(localSessionId, block.id) : null

  const query = useQuery({
    queryKey: ["block-run", realId, block.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("block_runs")
        .select("started_at, finished_at")
        .eq("session_id", realId)
        .eq("block_id", block.id)
        .maybeSingle()
      if (error) throw error
      return parseRunRow(data)
    },
    enabled: isAmrap && realId != null && queued == null,
  })

  const [localStart, setLocalStart] = useState<number | null>(null)
  const [localFinish, setLocalFinish] = useState<number | null>(null)

  const startedAt =
    localStart ?? queued?.startedAt ?? query.data?.startedAt ?? null
  const finishedAt =
    localFinish ?? queued?.finishedAt ?? query.data?.finishedAt ?? null
  const hydratePending =
    isAmrap && realId != null && queued == null && query.isPending

  const stampGo = useCallback(
    (at: number) => {
      if (!isAmrap || block.cap_seconds == null) return
      setLocalStart(at)
      enqueueBlockRun({
        sessionId: localSessionId,
        blockId: block.id,
        startedAt: at,
        finishedAt: null,
        mode: "amrap",
        capSeconds: block.cap_seconds,
        templateFingerprint: templateFingerprint(block),
      })
      scheduleImmediateDrain()
    },
    [isAmrap, block, localSessionId],
  )

  const stampFinish = useCallback(
    (at: number) => {
      if (!isAmrap || block.cap_seconds == null) return
      setLocalFinish(at)
      enqueueBlockRun({
        sessionId: localSessionId,
        blockId: block.id,
        startedAt: startedAt ?? at,
        finishedAt: at,
        mode: "amrap",
        capSeconds: block.cap_seconds,
        templateFingerprint: templateFingerprint(block),
      })
      scheduleImmediateDrain()
    },
    [isAmrap, block, localSessionId, startedAt],
  )

  const discardRun = useCallback(async () => {
    if (!isAmrap) return
    setLocalStart(null)
    setLocalFinish(null)
    if (realId) await discardBlockRun(realId, block.id)
  }, [isAmrap, realId, block.id])

  return {
    startedAt,
    finishedAt,
    hydratePending,
    stampGo,
    stampFinish,
    discardRun,
  }
}
