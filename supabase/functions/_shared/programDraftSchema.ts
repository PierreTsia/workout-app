/**
 * Shared program-draft JSON schemas (T168).
 * Groq uses OpenAI-style lowercase; Gemini uses uppercase type names.
 * Keep both in lockstep — see `programDraftSchema_test.ts`.
 */

const CIRCUIT_NESTED_GROQ = {
  type: "object",
  additionalProperties: false,
  properties: {
    exercise_id: { type: "string" },
    amount: { type: "number" },
    weight_kg: { type: "number" },
    per_round: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          amount: { type: "number" },
          weight_kg: { type: "number" },
        },
        required: ["amount", "weight_kg"],
      },
    },
  },
  required: ["exercise_id"],
} as const

const CIRCUIT_ITEM_GROQ = {
  type: "object",
  additionalProperties: false,
  properties: {
    type: { type: "string", const: "circuit" },
    label: { type: "string" },
    mode: { type: "string", enum: ["rounds", "amrap"] },
    cap_minutes: { type: "integer", minimum: 1, maximum: 60 },
    rounds: { type: "integer" },
    rest_seconds: { type: "integer" },
    transition_seconds: { type: "integer" },
    exercises: {
      type: "array",
      items: CIRCUIT_NESTED_GROQ,
    },
  },
  required: ["type", "exercises"],
} as const

/** OpenAI/Groq strict JSON Schema for program draft responses. */
export const PROGRAM_JSON_SCHEMA_GROQ = {
  type: "object",
  additionalProperties: false,
  properties: {
    rationale: { type: "string" },
    days: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          muscle_focus: { type: "string" },
          exercises: {
            type: "array",
            items: {
              anyOf: [{ type: "string" }, CIRCUIT_ITEM_GROQ],
            },
          },
        },
        required: ["label", "muscle_focus", "exercises"],
      },
    },
  },
  required: ["rationale", "days"],
} as const

/** Gemini responseSchema (uppercase type tokens). */
export const PROGRAM_RESPONSE_SCHEMA_GEMINI = {
  type: "OBJECT",
  properties: {
    rationale: { type: "STRING" },
    days: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          label: { type: "STRING" },
          muscle_focus: { type: "STRING" },
          exercises: {
            type: "ARRAY",
            items: {
              anyOf: [
                { type: "STRING" },
                {
                  type: "OBJECT",
                  properties: {
                    type: { type: "STRING" },
                    label: { type: "STRING" },
                    mode: { type: "STRING" },
                    cap_minutes: { type: "INTEGER" },
                    rounds: { type: "INTEGER" },
                    rest_seconds: { type: "INTEGER" },
                    transition_seconds: { type: "INTEGER" },
                    exercises: {
                      type: "ARRAY",
                      items: {
                        type: "OBJECT",
                        properties: {
                          exercise_id: { type: "STRING" },
                          amount: { type: "NUMBER" },
                          weight_kg: { type: "NUMBER" },
                          per_round: {
                            type: "ARRAY",
                            items: {
                              type: "OBJECT",
                              properties: {
                                amount: { type: "NUMBER" },
                                weight_kg: { type: "NUMBER" },
                              },
                              required: ["amount", "weight_kg"],
                            },
                          },
                        },
                        required: ["exercise_id"],
                      },
                    },
                  },
                  required: ["type", "exercises"],
                },
              ],
            },
          },
        },
        required: ["label", "muscle_focus", "exercises"],
      },
    },
  },
  required: ["rationale", "days"],
} as const
