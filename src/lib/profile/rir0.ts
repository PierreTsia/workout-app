import type { SetFact } from "@/lib/profile/types"

export function rir0Rate(sets: readonly Pick<SetFact, "rir">[]): number | null {
  const declared = sets.filter((set) => set.rir != null)
  if (declared.length === 0) return null
  const failures = declared.filter((set) => set.rir === 0).length
  return Math.round((failures / declared.length) * 100)
}
