import { corsHeaders } from "../_shared/cors.ts"
import { createUserClient } from "../_shared/supabase.ts"
import {
  extractPrefix,
  generatePAT,
  hashPAT,
} from "../_shared/patFormat.ts"
import {
  PAT_QUOTA,
  PG_UNIQUE_VIOLATION,
  checkJWTNotPATDerived,
  computeExpiresAt,
  validateCreatePATBody,
} from "./createPatLogic.ts"

/**
 * `create-pat` Edge Function — mints a Personal Access Token for the
 * authenticated user.
 *
 * Flow:
 *   1. POST + Bearer header required.
 *   2. Validate JWT signature + expiry via `supabase.auth.getUser`.
 *   3. Reject PAT-derived JWTs (`aal: 'pat'`) — anti-escalation invariant.
 *   4. Validate body (name 1..64 chars trimmed, lifetime_days in
 *      {30, 90, 365, null}).
 *   5. Quota check (≤ 10 active PATs per user, soft cap, non-transactional).
 *   6. Generate plaintext, HMAC-hash with PAT_PEPPER over the FULL plaintext
 *      including the `glp_` prefix, insert via user-context client
 *      (RLS enforces auth.uid() = user_id).
 *   7. Return `{ token, prefix, expires_at }` ONCE. Plaintext is never
 *      logged anywhere.
 *
 * !! IMPORTANT
 * Plaintext PAT values must NEVER reach `console.log` / `console.error` /
 * any error trace. Errors that would otherwise embed the token must redact
 * it explicitly. The single allowed exit point for plaintext is the
 * successful 200 response body.
 */

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders })
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405)
    }

    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Missing authorization header" }, 401)
    }

    const userClient = createUserClient(authHeader)

    // Step 1 — Signature + expiry validation via GoTrue. This rejects
    // forged or expired tokens before we touch any business logic.
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser()
    if (userErr || !user?.id) {
      return jsonResponse({ error: "Invalid or expired session" }, 401)
    }
    const userId = user.id

    // Step 2 — Anti-escalation: reject JWTs minted by the MCP function as
    // PAT-derived (`aal: 'pat'`). Decoding here is safe because step 1
    // already validated the signature.
    const jwt = authHeader.slice("Bearer ".length).trim()
    const aalCheck = checkJWTNotPATDerived(jwt)
    if (!aalCheck.ok) {
      const status = aalCheck.reason === "pat-derived" ? 403 : 401
      const error =
        aalCheck.reason === "pat-derived"
          ? "Cannot create a personal access token from a PAT-authenticated request"
          : "Malformed token"
      return jsonResponse({ error }, status)
    }

    // Step 3 — Body validation.
    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400)
    }
    const validation = validateCreatePATBody(rawBody)
    if (!validation.ok) {
      return jsonResponse(validation.body, validation.status)
    }
    const { name, lifetime_days } = validation.value

    // Step 4 — Pepper presence (env). Fail fast with 500 — this is a
    // misconfiguration, not a user error.
    const pepper = Deno.env.get("PAT_PEPPER")
    if (!pepper) {
      console.error("create-pat: PAT_PEPPER env var is missing")
      return jsonResponse({ error: "Server misconfigured" }, 500)
    }

    // Step 5 — Quota check. RLS auto-filters to the authenticated user's
    // rows (the `.eq("user_id", userId)` is belt-and-suspenders). The check
    // is non-transactional — a concurrent burst could squeeze through 11-12
    // tokens. Acceptable per the tech plan: cap is product-soft, not a
    // security boundary.
    const { count, error: countErr } = await userClient
      .from("personal_access_tokens")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
    if (countErr) {
      console.error("create-pat: quota check failed", countErr)
      return jsonResponse({ error: "Failed to check quota" }, 500)
    }
    if ((count ?? 0) >= PAT_QUOTA) {
      return jsonResponse(
        {
          error: `Maximum of ${PAT_QUOTA} active tokens reached. Revoke one before creating a new token.`,
          code: "quota_exceeded",
        },
        409,
      )
    }

    // Step 6 — Generate, hash, insert.
    const plaintext = generatePAT()
    const tokenHash = await hashPAT(plaintext, pepper)
    const prefix = extractPrefix(plaintext)
    const expiresAt = computeExpiresAt(lifetime_days)

    const { error: insertErr } = await userClient
      .from("personal_access_tokens")
      .insert({
        user_id: userId,
        name,
        token_hash: tokenHash,
        prefix,
        expires_at: expiresAt,
      })
    if (insertErr) {
      // (user_id, name) unique violation → 409. PostgREST surfaces the SQLSTATE
      // in `code`. We do NOT include the original error message in the response
      // — error messages from PostgREST may quote arbitrary input which we
      // never want round-tripped without sanitization.
      if (insertErr.code === PG_UNIQUE_VIOLATION) {
        return jsonResponse(
          {
            error: `A token named "${name}" already exists. Choose a different name or revoke the existing one.`,
            code: "duplicate_name",
          },
          409,
        )
      }
      console.error("create-pat: insert failed", { code: insertErr.code })
      return jsonResponse({ error: "Failed to create token" }, 500)
    }

    // Step 7 — Plaintext returned ONCE. The client (browser) is responsible
    // for displaying and helping the user copy. After this response we have
    // NO way to recover the plaintext — only the hash is stored.
    return jsonResponse({
      token: plaintext,
      prefix,
      expires_at: expiresAt,
    })
  } catch (err) {
    // Catch-all. Note: we log only the error message + name, never the full
    // error object — defensive against accidental plaintext capture by some
    // future code path that might attach the token to an error.
    const message = err instanceof Error ? err.message : "unknown"
    const name = err instanceof Error ? err.name : "unknown"
    console.error("create-pat: unhandled error", { name, message })
    return jsonResponse({ error: "Failed to create token" }, 500)
  }
})
