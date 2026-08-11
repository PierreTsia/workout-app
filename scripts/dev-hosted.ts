/**
 * `npm run dev` against the **hosted** Supabase project, even when `.env.local`
 * points at loopback. Required for Prime Mover Tour captures.
 *
 *   npm run dev:hosted
 */

import { spawn } from "node:child_process"
import { resolveHostedViteEnv } from "./resolve-hosted-vite-env.js"

const hosted = resolveHostedViteEnv()
console.log(
  `[dev:hosted] VITE_SUPABASE_URL ← ${new URL(hosted.VITE_SUPABASE_URL).hostname} (from ${hosted.source})`,
)

const child = spawn("npx", ["vite", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: {
    ...process.env,
    VITE_SUPABASE_URL: hosted.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: hosted.VITE_SUPABASE_ANON_KEY,
  },
  shell: true,
})

child.on("exit", (code) => process.exit(code ?? 1))
