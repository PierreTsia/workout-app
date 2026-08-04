import { describe, expect, it } from "vitest"
import {
  MCP_CIRCUIT_DAY_ITEM_SCHEMA,
  MCP_CIRCUIT_NESTED_EXERCISE_SCHEMA,
} from "./circuitItemSchema"
import { CIRCUIT_BOUNDS } from "./createProgramValidation"

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
})
