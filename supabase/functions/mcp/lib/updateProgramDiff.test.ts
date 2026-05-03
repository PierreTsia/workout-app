import { describe, expect, it } from "vitest"
import fixtures from "./updateProgram_fixtures.json"
import { computeProgramDiff } from "./updateProgramDiff"
import type {
  CurrentProgramSnapshot,
  ParsedPatch,
  ProgramDiff,
} from "./updateProgramTypes"

interface Scenario {
  name: string
  current: CurrentProgramSnapshot
  patch: ParsedPatch
  expected: ProgramDiff
}

describe("computeProgramDiff", () => {
  for (const scenario of fixtures as unknown as Scenario[]) {
    it(scenario.name, () => {
      const result = computeProgramDiff(scenario.current, scenario.patch)
      expect(result).toEqual(scenario.expected)
    })
  }

  it("does not mutate input current or patch", () => {
    // Use the busiest fixture to maximise the surface area we'd notice mutating.
    const scenario = (fixtures as unknown as Scenario[]).find(
      (s) => s.name === "mixed (add + remove + update)",
    )
    if (!scenario) throw new Error("expected 'mixed' fixture to exist")

    const currentClone: CurrentProgramSnapshot = JSON.parse(
      JSON.stringify(scenario.current),
    )
    const patchClone: ParsedPatch = JSON.parse(JSON.stringify(scenario.patch))

    computeProgramDiff(scenario.current, scenario.patch)

    expect(scenario.current).toEqual(currentClone)
    expect(scenario.patch).toEqual(patchClone)
  })
})
