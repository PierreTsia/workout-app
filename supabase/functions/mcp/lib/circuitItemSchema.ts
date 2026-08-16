/**
 * Shared JSON Schema fragments for MCP Circuit Items (ADR 0011).
 * Used by create_program / update_program tool `inputSchema` so agents see
 * the two nested shapes (flat amount/weight_kg vs per_round), not a bare object.
 */

import { BOUNDS, CIRCUIT_BOUNDS } from "./createProgramValidation.ts"

/** One nested Circuit exercise: flat prescription OR expanded per_round. */
export const MCP_CIRCUIT_NESTED_EXERCISE_SCHEMA = {
  oneOf: [
    {
      type: "object",
      description:
        "Flat Circuit nested exercise — same amount/weight_kg repeated across all rounds.",
      properties: {
        exercise_id: {
          type: "string",
          description: "UUID from resolve_exercises or search_exercises.",
        },
        amount: {
          type: "integer",
          minimum: CIRCUIT_BOUNDS.amount_reps.min,
          maximum: CIRCUIT_BOUNDS.amount_duration.max,
          description:
            "Reps (1–50) or duration seconds (5–600) — catalog measurement_type decides which band applies at validation.",
        },
        weight_kg: {
          type: "number",
          minimum: BOUNDS.weight_kg.min,
          maximum: BOUNDS.weight_kg.max,
          description: "Working weight; 0 for bodyweight.",
        },
      },
      required: ["exercise_id", "amount", "weight_kg"],
    },
    {
      type: "object",
      description:
        "Pyramid / varying Circuit nested exercise — per_round length must equal Circuit rounds.",
      properties: {
        exercise_id: {
          type: "string",
          description: "UUID from resolve_exercises or search_exercises.",
        },
        per_round: {
          type: "array",
          minItems: CIRCUIT_BOUNDS.rounds.min,
          maxItems: CIRCUIT_BOUNDS.rounds.max,
          description:
            "One cell per round; length must equal the Circuit's rounds field.",
          items: {
            type: "object",
            properties: {
              amount: {
                type: "integer",
                minimum: CIRCUIT_BOUNDS.amount_reps.min,
                maximum: CIRCUIT_BOUNDS.amount_duration.max,
              },
              weight_kg: {
                type: "number",
                minimum: BOUNDS.weight_kg.min,
                maximum: BOUNDS.weight_kg.max,
              },
            },
            required: ["amount", "weight_kg"],
          },
        },
      },
      required: ["exercise_id", "per_round"],
    },
  ],
} as const

/** Full MCP Circuit Item for a day's exercises[] entry. */
export const MCP_CIRCUIT_DAY_ITEM_SCHEMA = {
  type: "object",
  description:
    "Circuit (MCP Circuit Item). Nested exercises use {amount, weight_kg} or per_round — never solo sets/reps. See ADR 0011.",
  properties: {
    type: { type: "string", const: "circuit" },
    label: { type: "string" },
    mode: {
      type: "string",
      enum: ["rounds", "amrap"],
      description:
        'Termination mode. Omit or "rounds" = Tours (N rounds). "amrap" = time cap; do not send rounds, rest_seconds, transition_seconds, or nested per_round.',
    },
    cap_minutes: {
      type: "integer",
      minimum: CIRCUIT_BOUNDS.cap_minutes.min,
      maximum: CIRCUIT_BOUNDS.cap_minutes.max,
      description:
        "AMRAP cap in minutes (default 20). Only valid with mode \"amrap\". Persisted as cap_seconds = minutes * 60.",
    },
    rounds: {
      type: "integer",
      minimum: CIRCUIT_BOUNDS.rounds.min,
      maximum: CIRCUIT_BOUNDS.rounds.max,
    },
    rest_seconds: {
      type: "integer",
      minimum: CIRCUIT_BOUNDS.rest_seconds.min,
      maximum: CIRCUIT_BOUNDS.rest_seconds.max,
    },
    transition_seconds: {
      type: "integer",
      minimum: CIRCUIT_BOUNDS.transition_seconds.min,
      maximum: CIRCUIT_BOUNDS.transition_seconds.max,
    },
    exercises: {
      type: "array",
      minItems: CIRCUIT_BOUNDS.exercises.min,
      maxItems: CIRCUIT_BOUNDS.exercises.max,
      items: MCP_CIRCUIT_NESTED_EXERCISE_SCHEMA,
    },
    benchmark_slug: {
      type: "string",
      description:
        'Catalog handle (e.g. "cindy"). When present, catalog Rx wins — do not send a reconstructed 5-10-15. Unknown slug is an error.',
    },
    benchmark_id: {
      type: "string",
      description: "Catalog uuid. Same as benchmark_slug: catalog Rx wins; unknown id is an error.",
    },
  },
  required: ["type"],
} as const
