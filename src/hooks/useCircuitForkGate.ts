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
      "id, owner_id, label, aliases, tagline_fr, tagline_en, story_fr, story_en, reference, rx",
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
  persist: () => void | Promise<void>,
  revert: () => void,
) => Promise<void>

export async function persistGatedMutation(
  write: () => Promise<unknown>,
  report: (state: "saving" | "saved" | "error") => void,
): Promise<void> {
  report("saving")
  try {
    await write()
    report("saved")
  } catch (err) {
    report("error")
    throw err
  }
}

export function useCircuitForkGate(
  block: {
    id: string
    benchmark_circuit_id?: string | null
  },
  options?: { onError?: () => void },
) {
  const user = useAtomValue(authAtom)
  const onError = options?.onError
  const [open, setOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [forkedCatalogId, setForkedCatalogId] = useState<string | null>(null)
  const [gateBlockId, setGateBlockId] = useState(block.id)
  if (gateBlockId !== block.id) {
    setGateBlockId(block.id)
    setForkedCatalogId(null)
  }
  const catalogId = forkedCatalogId ?? block.benchmark_circuit_id ?? null
  const heldRef = useRef<{
    pending: CircuitForkPending
    persist: () => void | Promise<void>
    revert: () => void
  } | null>(null)

  const failHeld = useCallback(
    (revert: () => void) => {
      revert()
      onError?.()
      heldRef.current = null
      setOpen(false)
    },
    [onError],
  )

  const requestPersist = useCallback<RequestCircuitForkPersist>(
    async (pending, persist, revert) => {
      if (catalogId == null) {
        await persist()
        return
      }
      if (user == null) {
        revert()
        return
      }
      const catalog = await loadCatalogViaSupabase(catalogId)
      if (catalog == null) {
        revert()
        onError?.()
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
        await persist()
        return
      }
      heldRef.current = { pending, persist, revert }
      setOpen(true)
    },
    [catalogId, onError, user],
  )

  const closeHeld = useCallback(() => {
    const held = heldRef.current
    if (held == null) return
    held.revert()
    heldRef.current = null
    setOpen(false)
  }, [])

  const confirm = useCallback(async () => {
    const held = heldRef.current
    if (held == null || user == null || catalogId == null) return
    setIsPending(true)
    try {
      const catalog = await loadCatalogViaSupabase(catalogId)
      if (catalog == null) {
        failHeld(held.revert)
        return
      }
      const { forkedId } = await persistCircuitFork(supabaseCircuitForkWriter, {
        catalog,
        currentUserId: user.id,
        pending: held.pending,
        blockId: block.id,
        persistMeta: async () => {
          await held.persist()
        },
      })
      setForkedCatalogId(forkedId)
      heldRef.current = null
      setOpen(false)
    } catch {
      failHeld(held.revert)
    } finally {
      setIsPending(false)
    }
  }, [block.id, catalogId, failHeld, user])

  const onOpenChange = useCallback(
    (next: boolean) => {
      if (!next) closeHeld()
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
