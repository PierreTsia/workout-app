/** Same bounds as MCP `CIRCUIT_BOUNDS.cap_minutes` (T187). */
export const AMRAP_CAP_MINUTES = { min: 1, max: 60, default: 20 } as const

type CircuitLike = {
  mode?: "rounds" | "amrap"
  cap_minutes?: number
  rounds?: number
  rest_seconds?: number
  transition_seconds?: number
  exercises: readonly unknown[]
}

function nestedHasPerRound(ex: unknown): boolean {
  return typeof ex === "object" && ex !== null && "per_round" in ex
}

/** T187/T189: AMRAP + Tours fields is a hard reject, not a silent drop of keys. */
export function amrapLeaksToursFields(raw: CircuitLike): boolean {
  if (raw.mode !== "amrap") return false
  if (
    raw.rounds !== undefined ||
    raw.rest_seconds !== undefined ||
    raw.transition_seconds !== undefined
  ) {
    return true
  }
  return raw.exercises.some(nestedHasPerRound)
}

export function isAmrapCapInBounds(cap: number | undefined): boolean {
  if (cap === undefined) return true
  return (
    Number.isInteger(cap) &&
    cap >= AMRAP_CAP_MINUTES.min &&
    cap <= AMRAP_CAP_MINUTES.max
  )
}

export function shouldRejectAmrapCircuit(raw: CircuitLike): boolean {
  if (raw.mode !== "amrap") return false
  return amrapLeaksToursFields(raw) || !isAmrapCapInBounds(raw.cap_minutes)
}

type CircuitWireFields = {
  mode?: "rounds" | "amrap"
  cap_minutes?: number
  rounds?: number
  rest_seconds?: number
  transition_seconds?: number
}

/** Tours omit mode/cap; AMRAP keeps only mode + cap (default 20). */
export function circuitTerminationFields(raw: CircuitLike): CircuitWireFields {
  if (raw.mode === "amrap") {
    return {
      mode: "amrap",
      cap_minutes: raw.cap_minutes ?? AMRAP_CAP_MINUTES.default,
    }
  }
  return {
    ...(raw.rounds !== undefined ? { rounds: raw.rounds } : {}),
    ...(raw.rest_seconds !== undefined ? { rest_seconds: raw.rest_seconds } : {}),
    ...(raw.transition_seconds !== undefined
      ? { transition_seconds: raw.transition_seconds }
      : {}),
  }
}
