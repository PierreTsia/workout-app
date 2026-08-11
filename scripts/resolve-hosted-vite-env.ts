/**
 * Resolve VITE_SUPABASE_* for Tour captures / hosted demo work.
 *
 * Vite loads `.env.local` *over* `.env`, so a local stack in `.env.local`
 * silently breaks Prime Mover session injection (auth token is for hosted).
 * Capture tooling must prefer the hosted values from `.env` when `.env.local`
 * points at loopback.
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import dotenv from "dotenv"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {}
  return dotenv.parse(fs.readFileSync(filePath))
}

function isLoopbackUrl(raw: string | undefined): boolean {
  if (!raw?.trim()) return false
  try {
    const host = new URL(raw.trim()).hostname
    return host === "127.0.0.1" || host === "localhost" || host === "::1"
  } catch {
    return false
  }
}

export type HostedViteEnv = {
  VITE_SUPABASE_URL: string
  VITE_SUPABASE_ANON_KEY: string
  source: "env" | "env.local" | "process"
}

/**
 * Prefer process env if already set to a non-loopback URL; else `.env` hosted;
 * else non-loopback `.env.local`. Never returns loopback.
 */
export function resolveHostedViteEnv(): HostedViteEnv {
  const fromProcessUrl = process.env.VITE_SUPABASE_URL?.trim()
  const fromProcessKey = process.env.VITE_SUPABASE_ANON_KEY?.trim()
  if (fromProcessUrl && fromProcessKey && !isLoopbackUrl(fromProcessUrl)) {
    return {
      VITE_SUPABASE_URL: fromProcessUrl,
      VITE_SUPABASE_ANON_KEY: fromProcessKey,
      source: "process",
    }
  }

  const envFile = parseEnvFile(path.join(ROOT, ".env"))
  const localFile = parseEnvFile(path.join(ROOT, ".env.local"))

  const envUrl = envFile.VITE_SUPABASE_URL?.trim()
  const envKey = envFile.VITE_SUPABASE_ANON_KEY?.trim()
  if (envUrl && envKey && !isLoopbackUrl(envUrl)) {
    return {
      VITE_SUPABASE_URL: envUrl,
      VITE_SUPABASE_ANON_KEY: envKey,
      source: "env",
    }
  }

  const localUrl = localFile.VITE_SUPABASE_URL?.trim()
  const localKey = localFile.VITE_SUPABASE_ANON_KEY?.trim()
  if (localUrl && localKey && !isLoopbackUrl(localUrl)) {
    return {
      VITE_SUPABASE_URL: localUrl,
      VITE_SUPABASE_ANON_KEY: localKey,
      source: "env.local",
    }
  }

  throw new Error(
    "No hosted VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY found.\n" +
      "Put the production project values in `.env` (keep loopback in `.env.local` for local stack).",
  )
}

export function authStorageKey(supabaseUrl: string): string {
  const host = new URL(supabaseUrl).hostname
  const ref = host.split(".")[0] ?? "unknown"
  return `sb-${ref}-auth-token`
}

export function viteWouldUseLoopback(): boolean {
  const localFile = parseEnvFile(path.join(ROOT, ".env.local"))
  return isLoopbackUrl(localFile.VITE_SUPABASE_URL)
}
