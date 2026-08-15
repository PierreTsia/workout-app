import { describe, expect, it } from "vitest"
import {
  MCP_CIRCUIT_DAY_ITEM_SCHEMA,
  MCP_CIRCUIT_NESTED_EXERCISE_SCHEMA,
} from "./circuitItemSchema"
import { CIRCUIT_BOUNDS } from "./createProgramValidation"
import { createProgram } from "../tools/createProgram"
import { updateProgram } from "../tools/updateProgram"

function dayItemOneOf(tool: { inputSchema: { properties: Record<string, unknown> } }): unknown[] {
  const days = tool.inputSchema.properties.days
  if (days === null || typeof days !== "object" || !("items" in days)) return []
  const dayItems = days.items
  if (dayItems === null || typeof dayItems !== "object" || !("properties" in dayItems)) return []
  const props = dayItems.properties
  if (props === null || typeof props !== "object" || !("exercises" in props)) return []
  const exercises = props.exercises
  if (exercises === null || typeof exercises !== "object" || !("items" in exercises)) return []
  const items = exercises.items
  if (items === null || typeof items !== "object" || !("oneOf" in items)) return []
  return Array.isArray(items.oneOf) ? items.oneOf : []
}

describe("MCP_CIRCUIT_NESTED_EXERCISE_SCHEMA", () => {
  it("encodes flat and per_round nested shapes as oneOf", () => {
    expect(MCP_CIRCUIT_NESTED_EXERCISE_SCHEMA.oneOf).toHaveLength(2)

    const [flat, perRound] = MCP_CIRCUIT_NESTED_EXERCISE_SCHEMA.oneOf
    expect(flat.required).toEqual(["exercise_id", "amount", "weight_kg"])
    expect(flat.properties).toHaveProperty("amount")
    expect(flat.properties).toHaveProperty("weight_kg")
    expect(flat.properties).not.toHaveProperty("per_round")

    expect(perRound.required).toEqual(["exercise_id", "per_round"])
    expect(perRound.properties.per_round.items.required).toEqual([
      "amount",
      "weight_kg",
    ])
    expect(perRound.properties.per_round.maxItems).toBe(CIRCUIT_BOUNDS.rounds.max)
  })
})

describe("MCP_CIRCUIT_DAY_ITEM_SCHEMA", () => {
  it("wires nested exercises schema into Circuit day-item exercises[]", () => {
    expect(MCP_CIRCUIT_DAY_ITEM_SCHEMA.properties.type).toEqual({
      type: "string",
      const: "circuit",
    })
    expect(MCP_CIRCUIT_DAY_ITEM_SCHEMA.required).toEqual(["type", "exercises"])
    expect(MCP_CIRCUIT_DAY_ITEM_SCHEMA.properties.exercises.items).toBe(
      MCP_CIRCUIT_NESTED_EXERCISE_SCHEMA,
    )
    expect(MCP_CIRCUIT_DAY_ITEM_SCHEMA.properties.exercises.minItems).toBe(
      CIRCUIT_BOUNDS.exercises.min,
    )
    expect(MCP_CIRCUIT_DAY_ITEM_SCHEMA.properties.exercises.maxItems).toBe(
      CIRCUIT_BOUNDS.exercises.max,
    )
  })

  it("exposes mode and cap_minutes so agents can write AMRAP (T187)", () => {
    expect(MCP_CIRCUIT_DAY_ITEM_SCHEMA.properties.mode).toEqual({
      type: "string",
      enum: ["rounds", "amrap"],
      description:
        'Termination mode. Omit or "rounds" = Tours (N rounds). "amrap" = time cap; do not send rounds, rest_seconds, transition_seconds, or nested per_round.',
    })
    expect(MCP_CIRCUIT_DAY_ITEM_SCHEMA.properties.cap_minutes).toEqual({
      type: "integer",
      minimum: CIRCUIT_BOUNDS.cap_minutes.min,
      maximum: CIRCUIT_BOUNDS.cap_minutes.max,
      description:
        "AMRAP cap in minutes (default 20). Only valid with mode \"amrap\". Persisted as cap_seconds = minutes * 60.",
    })
  })

  it("is the Circuit oneOf arm on create_program and update_program", () => {
    expect(dayItemOneOf(createProgram)).toContain(MCP_CIRCUIT_DAY_ITEM_SCHEMA)
    expect(dayItemOneOf(updateProgram)).toContain(MCP_CIRCUIT_DAY_ITEM_SCHEMA)
  })
})
