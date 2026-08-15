/**
 * Closed-intent AMRAP heuristics shared by QW / draft / onboarding prompts (T189).
 * Fixture-assert these substrings — do not live-call an LLM.
 */
export const AMRAP_CLOSED_INTENT_RULES = [
  '- AMRAP is a closed-intent list only. Emit mode:"amrap" + cap_minutes (1–60, default 20) when the user says AMRAP, « autant de tours », Cindy, Holland, or gives a time cap WITHOUT a round count. Nested exercises stay flat {exercise_id, amount, weight_kg} — never rounds, rest_seconds, transition_seconds, or per_round.',
  '- Default is Tours: omit mode. "HIIT 20 min", "4 rounds in 20 min", and every other Circuit stay Tours (rounds + rest).',
].join("\n")
