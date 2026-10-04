import { describe, expect, it } from "vitest"

import {
  mintPreviewToken,
  verifyPreviewToken,
  type PreviewPayload,
} from "./previewToken"

/**
 * The **Preview Token** contract (ADR 0028): the server-side consent guard for a
 * view-initiated apply. A token that verifies under a different secret, or after expiry,
 * or with a tampered body, must be rejected — otherwise the model could apply without a click.
 */
const SECRET = "test-secret"

const payload = (over: Partial<PreviewPayload> = {}): PreviewPayload => ({
  u: "11111111-1111-4111-8111-111111111111",
  exp: Math.floor(Date.now() / 1000) + 60,
  p: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  confirm: false,
  patch: { program_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Push" },
  ...over,
})

describe("previewToken", () => {
  it("round-trips a payload", async () => {
    const base = payload()
    const token = await mintPreviewToken(base, SECRET)
    expect(await verifyPreviewToken(token, SECRET)).toEqual(base)
  })

  it("rejects an expired token", async () => {
    const token = await mintPreviewToken(payload({ exp: Math.floor(Date.now() / 1000) - 1 }), SECRET)
    expect(await verifyPreviewToken(token, SECRET)).toBeNull()
  })

  it("rejects a token signed with a different secret", async () => {
    const token = await mintPreviewToken(payload(), SECRET)
    expect(await verifyPreviewToken(token, "another-secret")).toBeNull()
  })

  it("rejects a tampered body", async () => {
    const token = await mintPreviewToken(payload(), SECRET)
    const [body, sig] = token.split(".")
    expect(await verifyPreviewToken(`${body}x.${sig}`, SECRET)).toBeNull()
  })

  it("rejects a malformed token", async () => {
    expect(await verifyPreviewToken("not-a-token", SECRET)).toBeNull()
    expect(await verifyPreviewToken("", SECRET)).toBeNull()
  })
})
