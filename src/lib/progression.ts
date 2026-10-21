import type { WorkoutExercise } from "@/types/database"
import {
  getAdjustmentTier,
  PROPORTIONAL_DELOAD_FACTOR,
  type AdjustmentTier,
  type WeightUnit,
} from "@/lib/rirSuggestion"
import { nextLoad, resolveLoadLadder } from "@/lib/loadLadder"

export type ProgressionRule =
  | "HOLD_INCOMPLETE"
  | "HOLD_NEAR_FAILURE"
  | "REPS_UP"
  | "DURATION_UP"
  | "WEIGHT_UP"
  | "SETS_UP"
  | "PLATEAU"
  | "DELOAD"

export interface VolumePrescription {
  type: "reps" | "duration"
  current: number
  min: number
  max: number
  increment: number
}

export interface ProgressionPrescription {
  volume: VolumePrescription
  currentWeight: number
  currentSets: number
  setRangeMin: number
  setRangeMax: number
  weightIncrement: number
  maxWeightReached: boolean
  /**
   * The intra-session engine's adjustment tier for this slot (ADR 0033): the
   * Deload rule reads it instead of re-deriving from the load, so a loaded
   * `cable` slot deloads on reps exactly as the in-session engine does.
   */
  adjustmentTier: AdjustmentTier
  /**
   * The **Load Ladder** for this slot, in kg — resolved once in
   * {@link buildPrescription}. `null` when the equipment declares no ladder
   * (bodyweight, band…), when the prescription is a duration one, or when the
   * caller passed no equipment: the WEIGHT_UP rule then keeps the inherited
   * increment. The engine never prescribes a load outside it (ADR 0034).
   */
  loadLadder: number[] | null
  /**
   * False when the **Manual Override Window** is open (the athlete edited the
   * Template Prescription since the last session): the engine then reads the
   * template, and the Deload rule must yield to that deliberate edit.
   */
  useSnapshot: boolean
  /** @deprecated Use volume.current — kept for backward compat */
  currentReps: number
  /** @deprecated Use volume.min */
  repRangeMin: number
  /** @deprecated Use volume.max */
  repRangeMax: number
}

export interface SetPerformance {
  reps: number
  weight: number
  completed: boolean
  rir: number | null
  durationSeconds?: number
  /** 1-based position of the set within its session — the anchor is read by this, never array position. */
  setNumber?: number
  /**
   * Progression anchor (ADR 0032) — the rep target actually in force for this set
   * when it was logged: the session-start target, or the intra-session engine's
   * applied suggestion once it moves. NULL on legacy rows and on sets the engine
   * never touched; `buildPrescription` then falls back to `prescribedReps`.
   */
  anchorReps?: number | null
  /**
   * Prescription Snapshot — the engine's pristine target for this set at session-start.
   * Source of `volume.current` / `currentSets` / `currentWeight` for subsequent sessions
   * when the **Manual Override Window** is closed. NULL on legacy rows pre-migration. See ADR 0006.
   */
  prescribedReps?: number | null
  prescribedWeight?: number | null
  prescribedSets?: number | null
  prescribedDurationSeconds?: number | null
}

export interface ProgressionSuggestion {
  rule: ProgressionRule
  reps: number
  weight: number
  sets: number
  reasonKey: string
  delta: string
  volumeType: "reps" | "duration"
  duration?: number
}

/**
 * One finished session of an **Exercise Slot**, summarised for the **Stall**
 * predicate: the served target (`anchor_reps ?? prescribed_reps` +
 * `prescribed_weight`, ADR 0032) and the session's average declared RIR.
 * Read by `get_slot_prescription_history`, ordered oldest → newest.
 */
export interface SlotSessionSummary {
  sessionFinishedAt: string | null
  prescribedReps: number | null
  anchorReps: number | null
  /** Coerced to 0 when the session recorded no load (bodyweight). */
  prescribedWeight: number
  /** Average of the *declared* RIR only — null when none was logged. */
  avgRir: number | null
}

/**
 * Consecutive sessions of a **Stall** before the engine breaks it with a
 * **Deload** (ADR 0033). A heuristic, to tune post-launch like the draft-step N.
 */
export const STALL_SESSIONS = 4

/** Stable key for a slot's prescription history: slot id + catalog movement. */
export function slotKey(workoutExerciseId: string, exerciseId: string): string {
  return `${workoutExerciseId}:${exerciseId}`
}

const DEFAULT_INCREMENT_KG = 2.5
const DUMBBELL_INCREMENT_KG = 2.0
const RIR_SAFETY_THRESHOLD = 1

const DEFAULT_DURATION_SECONDS = 30
const DURATION_BAND_LOW = 10
const DURATION_BAND_HIGH = 15
const DEFAULT_DURATION_INCREMENT = 5

/**
 * Progression ceiling for isometric/duration exercises (planks, hollow holds, hangs).
 * Unlike weighted lifts — which progress on load — bodyweight holds have only one
 * meaningful lever: time. Freezing `duration_range_max_seconds` to the starting
 * target (T75 behavior) made the engine declare PLATEAU on the very first successful
 * session. We instead keep climbing the hold in `DEFAULT_DURATION_INCREMENT` steps up
 * to this ceiling before a real plateau — past which a new stimulus beats raw seconds.
 * See issue #379.
 */
export const DURATION_TARGET_CEILING_SECONDS = 90

/**
 * Resolve the persisted `duration_range_max_seconds` so the progression engine always
 * has headroom: never cap below {@link DURATION_TARGET_CEILING_SECONDS}, but preserve a
 * higher explicit ceiling if a caller deliberately prescribed one (e.g. a 120s plank).
 */
export function deriveDurationRangeMax(baseMax: number): number {
  return Math.max(baseMax, DURATION_TARGET_CEILING_SECONDS)
}

export function resolveWeightIncrement(
  userIncrement: number | null | undefined,
  equipment?: string,
): number {
  if (userIncrement != null && userIncrement > 0) return userIncrement
  return equipment === "dumbbell" ? DUMBBELL_INCREMENT_KG : DEFAULT_INCREMENT_KG
}

export interface BuildPrescriptionOptions {
  measurementType?: "reps" | "duration"
  equipment?: string
  catalogExercise?: { default_duration_seconds?: number | null } | null
  /**
   * The athlete's display unit — selects which **Load Ladder** table to resolve.
   * Defaults to `"kg"`: callers that don't pass it keep their behaviour.
   */
  weightUnit?: WeightUnit
  /**
   * ISO timestamp of the most recent session that logged this exercise.
   * Compared against `exercise.template_updated_at` to decide whether the
   * **Manual Override Window** is open: if the user edited the template
   * since their last session, the engine reads from **Template Prescription**
   * (today's path). Otherwise it reads from the **Prescription Snapshot** on
   * the last session's set logs. See ADR 0006.
   */
  lastSessionFinishedAt?: string | null
}

/**
 * The set whose prescription the engine reads back for the next session: the last
 * logged set by `setNumber` (ADR 0032). Falls back to the first element when no
 * `setNumber` is present (legacy callers), preserving the pre-ADR behaviour.
 */
function pickAnchorSet(sets: SetPerformance[]): SetPerformance | undefined {
  return sets.reduce<SetPerformance | undefined>(
    (best, set) =>
      best === undefined ||
      (set.setNumber ?? -Infinity) > (best.setNumber ?? -Infinity)
        ? set
        : best,
    undefined,
  )
}

export function buildPrescription(
  exercise: WorkoutExercise,
  lastPerformance: SetPerformance[] | null,
  options: BuildPrescriptionOptions,
): ProgressionPrescription | null {
  const {
    measurementType,
    equipment,
    catalogExercise,
    lastSessionFinishedAt,
    weightUnit = "kg",
  } = options
  const isDuration = measurementType === "duration"

  // Manual Override Window: when the user edited the template since the last
  // session's finish, the snapshot is stale by definition — fall through to
  // template values. See ADR 0006.
  const useSnapshot =
    lastPerformance != null &&
    lastPerformance.length > 0 &&
    lastSessionFinishedAt != null &&
    new Date(exercise.template_updated_at) <= new Date(lastSessionFinishedAt)

  let volume: VolumePrescription

  if (isDuration) {
    const snapshotDuration = useSnapshot
      ? lastPerformance[0].prescribedDurationSeconds
      : null
    const target =
      snapshotDuration ??
      exercise.target_duration_seconds ??
      catalogExercise?.default_duration_seconds ??
      DEFAULT_DURATION_SECONDS
    volume = {
      type: "duration",
      current: target,
      min: exercise.duration_range_min_seconds ?? Math.max(5, target - DURATION_BAND_LOW),
      max: exercise.duration_range_max_seconds ?? target + DURATION_BAND_HIGH,
      increment: exercise.duration_increment_seconds ?? DEFAULT_DURATION_INCREMENT,
    }
  } else {
    // ADR 0032 — the anchor: the rep target in force at the LAST logged set. A
    // deliberate in-session deload (the intra-session engine) rides `anchorReps`
    // so it survives into the next prescription, while `prescribedReps` stays the
    // pristine snapshot (the deviations observatory's baseline, CONTEXT.md's
    // single rule). Read by `setNumber`, never array position: the two Last
    // Performance readers order sets oppositely. Both `anchorReps` and
    // `snapshotReps` are read from that one set: equivalent to `[0]` while
    // `prescribed_*` is constant across the session (the ADR 0006 invariant).
    const anchorSet = useSnapshot ? pickAnchorSet(lastPerformance) : undefined
    const anchorReps = anchorSet?.anchorReps ?? null
    const snapshotReps = anchorSet?.prescribedReps ?? null
    let currentReps: number
    if (anchorReps != null) {
      currentReps = anchorReps
    } else if (snapshotReps != null) {
      currentReps = snapshotReps
    } else {
      currentReps = parseInt(exercise.reps, 10)
      if (isNaN(currentReps)) {
        const inferredReps = lastPerformance?.[0]?.reps
        if (!inferredReps || inferredReps <= 0) return null
        currentReps = inferredReps
      }
    }
    volume = {
      type: "reps",
      current: currentReps,
      min: exercise.rep_range_min ?? Math.max(1, currentReps - 2),
      max: exercise.rep_range_max ?? currentReps + 2,
      increment: 1,
    }
  }

  // Weight axis tracks REALITY (the load actually lifted), not the engine's
  // session-start prescription. This is the one axis where ADR 0006's unifying
  // "read prescribed_*" rule was wrong: unlike reps/sets/duration — where the
  // snapshot preserves the HOLD_INCOMPLETE signal ("attempted 11, managed 8") —
  // there is no "incomplete weight". The user lifted exactly what they lifted.
  // Reading prescribed_weight let the engine read back its own stale bootstrap
  // suggestion forever, so a user grinding 50kg under a 29.5kg prescription kept
  // being shown 29.5kg session after session (follow-up to #381). This restores the
  // pre-ADR-0006 behavior the ADR unified away by accident (see ADR ctx §2).
  //   - snapshot path (override window closed): last session's logged weight.
  //   - template path (bootstrap OR override window open): template wins, so a
  //     deliberate Builder deload still lands.
  //   - A 0 logged weight means "no load recorded" → fall back to template
  //     (bodyweight / unset case).
  const templateWeight = Number(exercise.weight) || 0
  const loggedWeight = useSnapshot ? lastPerformance[0].weight : null
  const currentWeight = loggedWeight && loggedWeight > 0 ? loggedWeight : templateWeight

  const snapshotSets = useSnapshot ? lastPerformance[0].prescribedSets : null
  const currentSets = snapshotSets ?? exercise.sets

  // The Load Ladder is resolved once, here: a duration prescription has no load
  // to place on a ladder, so it never resolves one (#713 stays open).
  const loadLadder =
    volume.type === "reps" ? resolveLoadLadder(equipment, weightUnit) : null

  return {
    volume,
    currentWeight,
    currentSets,
    setRangeMin: exercise.set_range_min ?? Math.max(1, currentSets - 1),
    setRangeMax: exercise.set_range_max ?? Math.min(6, currentSets + 2),
    weightIncrement: resolveWeightIncrement(exercise.weight_increment ?? null, equipment),
    maxWeightReached: exercise.max_weight_reached ?? false,
    adjustmentTier: getAdjustmentTier(equipment ?? "", currentWeight),
    loadLadder,
    useSnapshot,
    currentReps: volume.type === "reps" ? volume.current : 0,
    repRangeMin: volume.type === "reps" ? volume.min : 0,
    repRangeMax: volume.type === "reps" ? volume.max : 0,
  }
}

/** One decimal, for a load delta string the pill re-parses as a number. */
const round1 = (value: number): number => Math.round(value * 10) / 10

function averageRir(sets: SetPerformance[]): number | null {
  const withRir = sets.filter((s) => s.completed && s.rir != null)
  if (withRir.length === 0) return null
  return withRir.reduce((sum, s) => sum + s.rir!, 0) / withRir.length
}

/** The target the engine actually served that session — never the pristine snapshot (ADR 0032). */
function servedTarget(s: SlotSessionSummary): { reps: number; weight: number } {
  return {
    reps: s.anchorReps ?? s.prescribedReps ?? 0,
    weight: s.prescribedWeight ?? 0,
  }
}

/**
 * A **Stall**: `STALL_SESSIONS` consecutive sessions serving the *same* target,
 * the last one at an average RIR of 1 or below (ADR 0033). A target that moves —
 * up *or* down — is not a stall: a drop is an intervention (a served Deload, or a
 * manual edit) and must not read as one. An undeclared RIR is not a zero.
 */
export function shouldDeload(sessions: SlotSessionSummary[]): boolean {
  if (sessions.length < STALL_SESSIONS) return false

  const window = sessions.slice(-STALL_SESSIONS)
  const first = servedTarget(window[0])
  const stalled = window.every((s) => {
    const target = servedTarget(s)
    return target.reps === first.reps && target.weight === first.weight
  })
  if (!stalled) return false

  const lastRir = window[window.length - 1].avgRir
  return lastRir != null && lastRir <= 1
}

export interface ComputeNextSessionTargetOptions {
  /** The slot's recent sessions — the substrate of {@link shouldDeload}. */
  stallHistory?: SlotSessionSummary[]
}

export function computeNextSessionTarget(
  prescription: ProgressionPrescription,
  lastPerformance: SetPerformance[] | null,
  opts?: ComputeNextSessionTargetOptions,
): ProgressionSuggestion | null {
  if (!lastPerformance || lastPerformance.length === 0) return null

  const { volume, currentWeight, currentSets } = prescription
  const { setRangeMax, maxWeightReached, weightIncrement, loadLadder } = prescription

  const volumeValue = (s: SetPerformance) =>
    volume.type === "duration" ? (s.durationSeconds ?? 0) : s.reps

  const volumeRule: "REPS_UP" | "DURATION_UP" =
    volume.type === "duration" ? "DURATION_UP" : "REPS_UP"

  const makeSuggestion = (
    rule: ProgressionRule,
    vol: number,
    weight: number,
    sets: number,
    reasonKey: string,
    delta: string,
  ): ProgressionSuggestion => ({
    rule,
    reps: volume.type === "reps" ? vol : 0,
    weight,
    sets,
    reasonKey,
    delta,
    volumeType: volume.type,
    duration: volume.type === "duration" ? vol : undefined,
  })

  // A Deload preempts the whole rule chain: it is the only rule that can break a
  // hold loop — otherwise HOLD_NEAR_FAILURE would win every session of a Stall
  // (ADR 0033). The Manual Override Window wins over it, like every other rule.
  if (prescription.useSnapshot && shouldDeload(opts?.stallHistory ?? [])) {
    // A 0 kg slot on a weight-first tier (equipment `other`, or `""` while the
    // catalog row loads) has no load to shave: mirror the intra-session twin
    // (rirSuggestion.ts) and fall into the reps-only shape instead of raising
    // the load to one increment.
    const weightFirst =
      prescription.adjustmentTier === "weight-first" && currentWeight > 0
    const deloadedVolume = weightFirst
      ? volume.current
      : Math.max(
          1,
          Math.min(
            Math.round(volume.current * PROPORTIONAL_DELOAD_FACTOR),
            volume.current - 1,
          ),
        )
    const deloadedWeight = weightFirst
      ? Math.max(weightIncrement, currentWeight - weightIncrement)
      : currentWeight
    // A Deload that lowers nothing (weight-first at or below one increment,
    // reps-only at one rep) would leave the served target equal — the Stall
    // would never break and the rule would re-fire forever. Fall through to the
    // normal chain, which moves the target.
    if (deloadedVolume < volume.current || deloadedWeight < currentWeight) {
      return makeSuggestion(
        "DELOAD",
        deloadedVolume,
        deloadedWeight,
        currentSets,
        "progression.deload",
        "—",
      )
    }
  }

  const completedSets = lastPerformance.filter((s) => s.completed)
  const allCompleted = completedSets.length >= currentSets

  if (!allCompleted) {
    return makeSuggestion(
      "HOLD_INCOMPLETE",
      volume.current,
      currentWeight,
      currentSets,
      "progression.holdIncomplete",
      "—",
    )
  }

  const avgRir = averageRir(completedSets)
  if (avgRir != null && avgRir < RIR_SAFETY_THRESHOLD) {
    return makeSuggestion(
      "HOLD_NEAR_FAILURE",
      volume.current,
      currentWeight,
      currentSets,
      "progression.holdNearFailure",
      "—",
    )
  }

  const allHitTarget = completedSets.every((s) => volumeValue(s) >= volume.current)

  if (!allHitTarget) {
    return makeSuggestion(
      "HOLD_INCOMPLETE",
      volume.current,
      currentWeight,
      currentSets,
      "progression.holdIncomplete",
      "—",
    )
  }

  const allAtMax = completedSets.every((s) => volumeValue(s) >= volume.max)

  if (!allAtMax) {
    const nextVolume = Math.min(volume.current + volume.increment, volume.max)
    const actualDelta = nextVolume - volume.current
    const delta =
      volume.type === "duration"
        ? `+${actualDelta}s`
        : `+${actualDelta} rep`
    return makeSuggestion(
      volumeRule,
      nextVolume,
      currentWeight,
      currentSets,
      volume.type === "duration" ? "progression.durationUp" : "progression.repsUp",
      delta,
    )
  }

  if (!maxWeightReached) {
    const ladderNext = loadLadder ? nextLoad(loadLadder, currentWeight) : null
    if (ladderNext != null) {
      return makeSuggestion(
        "WEIGHT_UP",
        volume.min,
        ladderNext,
        currentSets,
        "progression.weightUp",
        String(round1(ladderNext - currentWeight)),
      )
    }
    return makeSuggestion(
      "WEIGHT_UP",
      volume.min,
      currentWeight + weightIncrement,
      currentSets,
      "progression.weightUp",
      String(weightIncrement),
    )
  }

  if (currentSets < setRangeMax) {
    return makeSuggestion(
      "SETS_UP",
      volume.min,
      currentWeight,
      currentSets + 1,
      "progression.setsUp",
      "+1 set",
    )
  }

  return makeSuggestion(
    "PLATEAU",
    volume.current,
    currentWeight,
    currentSets,
    "progression.plateau",
    "—",
  )
}
