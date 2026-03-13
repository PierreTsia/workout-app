/**
 * Load .env and .env.local into process.env so Node scripts see them.
 * Import this first in script entry points (before enrichment-config or other env-dependent imports).
 */
import dotenv from "dotenv"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")

dotenv.config({ path: path.join(root, ".env") })
dotenv.config({ path: path.join(root, ".env.local") })
