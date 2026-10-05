import { describe, it, expect, vi, beforeEach } from "vitest"
import { grantAchievementsForUser } from "./grantAchievements"

const rpc = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase", () => ({ supabase: { rpc } }))

function rpcResolves(data: unknown, error: unknown = null) {
  rpc.mockReturnValue({ returns: () => Promise.resolve({ data, error }) })
}

describe("grantAchievementsForUser", () => {
  beforeEach(() => {
    rpc.mockReset()
  })

  it("calls the RPC for the given user and coerces the rows", async () => {
    rpcResolves([
      { tier_id: "t1", group_slug: "volume_king", threshold_value: "5" },
    ])

    const out = await grantAchievementsForUser("u1")

    expect(rpc).toHaveBeenCalledWith("check_and_grant_achievements", {
      p_user_id: "u1",
    })
    expect(out).toHaveLength(1)
    expect(out[0].tier_id).toBe("t1")
    expect(out[0].threshold_value).toBe(5)
    expect(out[0].granted_at).toBeTruthy()
  })

  it("keeps an existing granted_at", async () => {
    rpcResolves([{ tier_id: "t1", threshold_value: 1, granted_at: "2026-01-01T00:00:00.000Z" }])

    const out = await grantAchievementsForUser("u1")

    expect(out[0].granted_at).toBe("2026-01-01T00:00:00.000Z")
  })

  it("returns [] and warns when the RPC errors", async () => {
    rpcResolves(null, { message: "boom" })
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    await expect(grantAchievementsForUser("u1")).resolves.toEqual([])
    expect(warn).toHaveBeenCalled()

    warn.mockRestore()
  })

  it("tolerates a non-array payload", async () => {
    rpcResolves(null)
    await expect(grantAchievementsForUser("u1")).resolves.toEqual([])
  })
})
