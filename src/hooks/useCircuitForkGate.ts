import { useCallback, useRef, useState } from "react"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import {
  needsCircuitFork,
  parseCircuitForkCatalog,
  parseInsertedForkId,
  persistCircuitFork,
  type CircuitForkInsertRow,
  type CircuitForkPending,
  type CircuitForkWriter,
} from "@/lib/circuitFork"

async function loadCatalogViaSupabase(id: string) {
  const { data, error } = await supabase
    .from("benchmark_circuits")
    .select(
      "id, owner_id, aliases, tagline_fr, tagline_en, story_fr, story_en, reference, rx",
    )
    .eq("id", id)
    .single()
  if (error) return null
  return parseCircuitForkCatalog(data)
}

const supabaseCircuitForkWriter: CircuitForkWriter = {
  async insertFork(row: CircuitForkInsertRow) {
    const { data, error } = await supabase
      .from("benchmark_circuits")
      .insert(row)
      .select("id")
      .single()
    if (error) throw error
    const id = parseInsertedForkId(data)
    if (id == null) throw new Error("circuitFork: insert returned no id")
    return { id }
  },
  async retargetBlock(blockId, forkedId) {
    const { error } = await supabase
      .from("exercise_blocks")
      .update({ benchmark_circuit_id: forkedId })
      .eq("id", blockId)
    if (error) throw error
  },
}

export type RequestCircuitForkPersist = (
  pending: CircuitForkPending,
  persist: () => void,
  revert: () => void,
) => Promise<void>

export function useCircuitForkGate(block: {
  id: string
  benchmark_circuit_id?: string | null
}) {
  const user = useAtomValue(authAtom)
  const [open, setOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const heldRef = useRef<{
    pending: CircuitForkPending
    persist: () => void
    revert: () => void
  } | null>(null)

  const requestPersist = useCallback<RequestCircuitForkPersist>(
    async (pending, persist, revert) => {
      const catalogId = block.benchmark_circuit_id
      if (catalogId == null) {
        persist()
        return
      }
      if (user == null) {
        revert()
        return
      }
      const catalog = await loadCatalogViaSupabase(catalogId)
      if (catalog == null) {
        revert()
        return
      }
      if (
        !needsCircuitFork({
          benchmarkCircuitId: catalogId,
          catalogOwnerId: catalog.owner_id,
          currentUserId: user.id,
          catalogRx: catalog.rx,
          pending,
        })
      ) {
        persist()
        return
      }
      heldRef.current = { pending, persist, revert }
      setOpen(true)
    },
    [block.benchmark_circuit_id, user],
  )

  const closeHeld = useCallback((action: "persist" | "revert") => {
    const held = heldRef.current
    if (held == null) return
    if (action === "persist") held.persist()
    else held.revert()
    heldRef.current = null
    setOpen(false)
  }, [])

  const confirm = useCallback(async () => {
    const held = heldRef.current
    const catalogId = block.benchmark_circuit_id
    if (held == null || user == null || catalogId == null) return
    setIsPending(true)
    try {
      const catalog = await loadCatalogViaSupabase(catalogId)
      if (catalog == null) {
        closeHeld("revert")
        return
      }
      await persistCircuitFork(supabaseCircuitForkWriter, {
        catalog,
        currentUserId: user.id,
        pending: held.pending,
        blockId: block.id,
      })
      closeHeld("persist")
    } catch {
      closeHeld("revert")
    } finally {
      setIsPending(false)
    }
  }, [block.benchmark_circuit_id, block.id, closeHeld, user])

  const onOpenChange = useCallback(
    (next: boolean) => {
      if (!next) closeHeld("revert")
      else setOpen(true)
    },
    [closeHeld],
  )

  return {
    forkOpen: open,
    isPending,
    requestPersist,
    confirm,
    onOpenChange,
  }
}
