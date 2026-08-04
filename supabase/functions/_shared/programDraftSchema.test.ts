import { describe, expect, it } from "vitest"
import {
  PROGRAM_JSON_SCHEMA_GROQ,
  PROGRAM_RESPONSE_SCHEMA_GEMINI,
} from "./programDraftSchema"

describe("program draft schema parity (T168)", () => {
  it("Gemini and Groq both expose mixed exercises (UUID | circuit) on days", () => {
    const groqDay = PROGRAM_JSON_SCHEMA_GROQ.properties.days.items.properties
    const geminiDay = PROGRAM_RESPONSE_SCHEMA_GEMINI.properties.days.items.properties

    expect(Object.keys(groqDay).sort()).toEqual(["exercises", "label", "muscle_focus"])
    expect(Object.keys(geminiDay).sort()).toEqual(["exercises", "label", "muscle_focus"])

    expect(groqDay.exercises.items.anyOf.map((x) => x.type)).toEqual([
      "string",
      "object",
    ])
    expect(geminiDay.exercises.items.anyOf.map((x) => x.type)).toEqual([
      "STRING",
      "OBJECT",
    ])

    const groqCircuit = groqDay.exercises.items.anyOf[1]
    const geminiCircuit = geminiDay.exercises.items.anyOf[1]
    expect(groqCircuit.required).toEqual(["type", "exercises"])
    expect(geminiCircuit.required).toEqual(["type", "exercises"])
    expect(groqCircuit.properties.type.const).toBe("circuit")
  })
})
