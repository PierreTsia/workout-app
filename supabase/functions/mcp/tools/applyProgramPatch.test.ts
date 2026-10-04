import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * `apply_program_patch` is the **App-Only Tool** a Decision Card calls (ADR 0028). These
 * tests pin the server guard: no token, a bad token, or a token for another account must
 * fail before any write, and a valid token must delegate to the single `update_program`
 * implementation with the echoed patch + implied confirm.
 */
const { handlerSpy } = vi.hoisted(() => ({ handlerSpy: vi.fn() }))

vi.mock("./updateProgram.ts", () => ({
  updateProgram: { handler: handlerSpy },
}))

import { applyProgramPatch } from "./applyProgramPatch"
import { mintPreviewToken } from "../lib/previewToken"

const USER = "11111111-1111-4111-8111-111111111111"
const OTHER = "22222222-2222-4222-8222-222222222222"
const PATCH = { program_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Push" }

type Handler = (
  args: Record<string, unknown>,
  supabase: unknown,
) => Promise<{ isError?: boolean; structuredContent?: unknown }>

const call = applyProgramPatch.handler as unknown as Handler

const makeSupabase = (userId: string) => ({
  auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) },
})

const tokenFor = (userId: string) =>
  mintPreviewToken(
    { u: userId, exp: Math.floor(Date.now() / 1000) + 60, p: PATCH.program_id, patch: PATCH },
    "test-secret",
  )

beforeEach(() => {
  handlerSpy.mockReset()
  handlerSpy.mockResolvedValue({
    content: [{ type: "text", text: "applied" }],
    structuredContent: { status: "applied" },
  })
  ;(globalThis as { Deno?: unknown }).Deno = {
    env: { get: (k: string) => (k === "MCP_PREVIEW_SECRET" ? "test-secret" : undefined) },
  }
})

describe("apply_program_patch", () => {
  it("declares itself app-only with a destructive write", () => {
    expect(applyProgramPatch._meta?.ui?.visibility).toEqual(["app"])
    expect(applyProgramPatch._meta?.ui?.resourceUri).toBeUndefined()
    expect(applyProgramPatch.annotations.destructiveHint).toBe(true)
  })

  it("refuses without a token and writes nothing", async () => {
    const result = await call({}, makeSupabase(USER))
    expect(result.isError).toBe(true)
    expect(handlerSpy).not.toHaveBeenCalled()
  })

  it("refuses an invalid token", async () => {
    const result = await call({ preview_token: "garbage" }, makeSupabase(USER))
    expect(result.isError).toBe(true)
    expect(handlerSpy).not.toHaveBeenCalled()
  })

  it("refuses a token that belongs to another account", async () => {
    const result = await call({ preview_token: await tokenFor(USER) }, makeSupabase(OTHER))
    expect(result.isError).toBe(true)
    expect(handlerSpy).not.toHaveBeenCalled()
  })

  it("delegates the echoed patch with confirm implied on a valid token", async () => {
    const supabase = makeSupabase(USER)
    const result = await call({ preview_token: await tokenFor(USER) }, supabase)
    expect(handlerSpy).toHaveBeenCalledWith({ ...PATCH, dry_run: false, confirm: true }, supabase)
    expect(result.structuredContent).toEqual({ status: "applied" })
  })
})
