import { describe, expect, it } from "vitest"
import {
  resolveEnglishInstructions,
  type ExerciseInstructions,
  type InstructionSource,
} from "./resolveInstructions"

const FRENCH: ExerciseInstructions = {
  setup: ["Allonge-toi sur le banc"],
  movement: ["Pousse la barre"],
  breathing: ["Expire à la poussée"],
  common_mistakes: ["Coudes trop écartés"],
}

const ENGLISH: ExerciseInstructions = {
  setup: ["Lie back on the bench"],
  movement: ["Press the bar up"],
  breathing: ["Exhale on the push"],
  common_mistakes: ["Flared elbows"],
}

const row = (overrides: Partial<InstructionSource> = {}): InstructionSource => ({
  instructions: FRENCH,
  instructions_en: ENGLISH,
  instructions_en_status: "clean",
  ...overrides,
})

describe("resolveEnglishInstructions", () => {
  it("serves English when status is clean and sections match", () => {
    expect(resolveEnglishInstructions(row())).toBe(ENGLISH)
  })

  it("serves English when a human approved the row", () => {
    expect(
      resolveEnglishInstructions(row({ instructions_en_status: "approved" })),
    ).toBe(ENGLISH)
  })

  it("falls back to French when a section is missing in English", () => {
    const incomplete = { ...ENGLISH, breathing: [] }
    expect(
      resolveEnglishInstructions(row({ instructions_en: incomplete })),
    ).toBe(FRENCH)
  })

  it.each([null, undefined, "flagged", "pending", ""])(
    "falls back to French for non-displayable status %j",
    (status) => {
      expect(
        resolveEnglishInstructions(row({ instructions_en_status: status })),
      ).toBe(FRENCH)
    },
  )

  it("returns null when both blocks are empty", () => {
    expect(
      resolveEnglishInstructions({
        instructions: { setup: [], movement: [], breathing: [], common_mistakes: [] },
        instructions_en: null,
        instructions_en_status: "approved",
      }),
    ).toBeNull()
  })
})
