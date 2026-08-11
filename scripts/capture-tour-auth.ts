/**
 * Build a Playwright storage-state file for the Prime Mover demo user.
 *
 * App UI is Google-only — capture tooling must inject a password session.
 *
 * Env (never commit):
 *   PRIME_MOVER_EMAIL          default primemover@example.com
 *   PRIME_MOVER_PASSWORD        required
 *   Hosted URL/key             from `.env` via resolve-hosted-vite-env
 *   CAPTURE_APP_ORIGIN         optional; also seeds common Vite ports
 *
 * Output (gitignored): playwright/.auth/prime-mover.json
 *
 *   PRIME_MOVER_PASSWORD=… npx tsx scripts/capture-tour-auth.ts
 */

import "./load-env.js"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import {
  authStorageKey,
  resolveHostedViteEnv,
  viteWouldUseLoopback,
} from "./resolve-hosted-vite-env.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

const EMAIL = process.env.PRIME_MOVER_EMAIL?.trim() || "primemover@example.com"
const PASSWORD = process.env.PRIME_MOVER_PASSWORD?.trim()

/** Playwright storageState is origin-scoped — cover Vite’s usual ports. */
function captureOrigins(): string[] {
  const primary = process.env.CAPTURE_APP_ORIGIN?.trim()
  const defaults = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
  ]
  return [...new Set([...(primary ? [primary] : []), ...defaults])]
}

async function main() {
  if (!PASSWORD) {
    console.error("Set PRIME_MOVER_PASSWORD (Dashboard password for Prime Mover).")
    process.exit(1)
  }

  const hosted = resolveHostedViteEnv()
  const SUPABASE_URL = hosted.VITE_SUPABASE_URL
  const ANON_KEY = hosted.VITE_SUPABASE_ANON_KEY

  console.log(
    `[capture-tour-auth] supabase=${new URL(SUPABASE_URL).hostname} (from ${hosted.source})`,
  )
  if (viteWouldUseLoopback()) {
    console.log(
      "[capture-tour-auth] Note: `.env.local` is loopback — run the app with `npm run dev:hosted` for captures.",
    )
  }

  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await anon.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  })
  if (error || !data.session) {
    console.error("signInWithPassword failed:", error?.message ?? "no session")
    process.exit(1)
  }

  const session = data.session
  const sessionPayload = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    token_type: session.token_type,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    user: session.user,
  }

  const localStorage = [
    { name: authStorageKey(SUPABASE_URL), value: JSON.stringify(sessionPayload) },
    { name: "locale", value: JSON.stringify("en") },
    { name: "weightUnit", value: JSON.stringify("kg") },
    { name: "workout-app-theme", value: JSON.stringify("dark") },
  ]

  const origins = captureOrigins().map((origin) => ({ origin, localStorage }))

  const storageState = { cookies: [], origins }

  const outDir = path.join(ROOT, "playwright", ".auth")
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, "prime-mover.json")
  fs.writeFileSync(outPath, JSON.stringify(storageState, null, 2))
  fs.writeFileSync(path.join(outDir, "prime-mover-user-id.txt"), session.user.id)

  console.log(`[capture-tour-auth] Wrote ${outPath}`)
  console.log(`[capture-tour-auth] user=${session.user.id}`)
  console.log(`[capture-tour-auth] origins=${origins.map((o) => o.origin).join(", ")}`)
  console.log("[capture-tour-auth] Prefs: EN / kg / dark")
  console.log(
    "[capture-tour-auth] Next: npm run dev:hosted\n" +
      "         then: CAPTURE_APP_ORIGIN=http://localhost:<port> npx tsx scripts/capture-tour-screens.ts",
  )
}

main()
