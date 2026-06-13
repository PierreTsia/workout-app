import type { PerRoundCell } from "@/types/database"

const ZERO_CELL: PerRoundCell = { amount: 0, weight: 0 }

/**
 * Resize a per-round prescription to `rounds` cells (#351, T139).
 * Growing copies the last cell (so a flat block stays flat); shrinking drops
 * trailing rounds, preserving the leading ones. Empty input seeds zeros.
 */
export function resizePerRound(
  cells: PerRoundCell[],
  rounds: number,
): PerRoundCell[] {
  if (rounds <= cells.length) return cells.slice(0, rounds)
  const fill = cells.length > 0 ? cells[cells.length - 1] : ZERO_CELL
  return [
    ...cells,
    ...Array.from({ length: rounds - cells.length }, () => ({ ...fill })),
  ]
}
