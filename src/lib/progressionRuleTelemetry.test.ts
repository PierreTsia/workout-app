import { vi, describe, it, expect, beforeEach } from "vitest"
import { getDefaultStore } from "jotai"
import { trackProgressionRuleServed } from "./progressionRuleTelemetry"
import { authAtom } from "@/store/atoms"

const { insertMock, thenMock } = vi.hoisted(() => ({
  insertMock: vi.fn(),
  thenMock: vi.fn(),
}))

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn(() => ({ insert: insertMock })) },
}))

const payload = {
  rule: "REPS_UP" as const,
  volumeType: "reps" as const,
  workoutExerciseId: "we-1",
  exerciseId: "ex-1",
  sessionId: "sess-1",
}

describe("trackProgressionRuleServed", () => {
  beforeEach(() => {
    insertMock.mockReset()
    thenMock.mockReset()
    insertMock.mockReturnValue({ then: thenMock })
    getDefaultStore().set(authAtom, null as never)
  })

  it("inserts one progression_rule_served event carrying the rule payload", () => {
    getDefaultStore().set(authAtom, { id: "user-1" } as never)

    trackProgressionRuleServed(payload)

    expect(insertMock).toHaveBeenCalledTimes(1)
    expect(insertMock).toHaveBeenCalledWith({
      event_type: "progression_rule_served",
      user_id: "user-1",
      payload,
    })
  })

  // The insert is a supabase thenable: without an explicit `then()` the request
  // is never sent (proven against @supabase/postgrest-js). This test guards the
  // fire, not just the builder construction.
  it("actually fires the insert (calls then on the builder)", () => {
    getDefaultStore().set(authAtom, { id: "user-1" } as never)

    trackProgressionRuleServed(payload)

    expect(thenMock).toHaveBeenCalled()
  })

  it("no-ops without a user", () => {
    trackProgressionRuleServed(payload)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it("swallows an insert failure — telemetry never reaches the UI", () => {
    getDefaultStore().set(authAtom, { id: "user-1" } as never)
    thenMock.mockImplementation((_ok: () => void, reject: () => void) => {
      reject()
    })

    expect(() => trackProgressionRuleServed(payload)).not.toThrow()
  })
})
