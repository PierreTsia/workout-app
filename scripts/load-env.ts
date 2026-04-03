/**
 * Load .env and .env.local into process.env so Node scripts see them.
 * Import this first in script entry points (before enrichment-config or other env-dependent imports).
 *
 * Pass `--no-env-local` on the command line to load only `.env` (e.g. prod backfills while
 * `.env.local` points at local Supabase).
 */
import dotenv from "dotenv"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")

const skipEnvLocal = process.argv.includes("--no-env-local")

dotenv.config({ path: path.join(root, ".env") })
if (!skipEnvLocal) {
  dotenv.config({ path: path.join(root, ".env.local") })
}
