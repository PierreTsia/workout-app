/**
 * Detect migration-history drift: a version applied to the database but absent
 * from the repo — the 21/10 incident, where five migrations went through the SQL
 * editor and the prod history no longer matched `supabase/migrations/`.
 *
 *   SUPABASE_DB_URL=postgresql://… npm run db:drift
 *
 * The URL is required and must name the *same* database the subsequent
 * `supabase db push` targets (the linked project). A silent localhost fallback
 * would let a clean local stack report OK while the real target drifts. A local
 * check is still possible — pass the local URL explicitly.
 *
 * Repo-only versions are normal here (migrations are pushed by hand) and are
 * reported without failing.
 */
import { execFileSync } from "node:child_process"
import { readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const MIGRATIONS_DIR = path.join(repoRoot, "supabase/migrations")

/** Host and database name only — never the userinfo (password) or query params. */
export const redactDbUrl = (dbUrl: string): string => {
  try {
    const url = new URL(dbUrl)
    const database = url.pathname.replace(/^\//, "")
    return `${url.hostname}${url.port ? `:${url.port}` : ""}/${database}`
  } catch {
    return "<URL illisible>"
  }
}

export const requireDbUrl = (env: NodeJS.ProcessEnv): string => {
  const dbUrl = env.SUPABASE_DB_URL
  if (!dbUrl) {
    throw new Error(
      "SUPABASE_DB_URL est requis : la vérification doit viser la même base que le `supabase db push` (le projet lié). Pour un check local, passe explicitement l'URL locale.",
    )
  }
  return dbUrl
}

export const compareMigrationVersions = (local: string[], remote: string[]) => {
  const localSet = new Set(local)
  const remoteSet = new Set(remote)
  return {
    remoteOnly: [...remoteSet].filter((v) => !localSet.has(v)).sort(),
    localOnly: [...localSet].filter((v) => !remoteSet.has(v)).sort(),
  }
}

const readLocalVersions = () =>
  readdirSync(MIGRATIONS_DIR)
    .map((file) => /^(\d+)_/.exec(file)?.[1])
    .filter((version): version is string => Boolean(version))

const readRemoteVersions = (dbUrl: string) =>
  execFileSync(
    "psql",
    [dbUrl, "-tAc", "select version from supabase_migrations.schema_migrations"],
    { encoding: "utf8" },
  )
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

const main = () => {
  let dbUrl: string
  try {
    dbUrl = requireDbUrl(process.env)
  } catch (err) {
    console.error(`\n${err instanceof Error ? err.message : String(err)}`)
    process.exit(2)
  }

  const local = readLocalVersions()

  let remote: string[]
  try {
    remote = readRemoteVersions(dbUrl)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error(
      `\nImpossible de lire l'historique des migrations dans la base (${redactDbUrl(dbUrl)}).`,
    )
    console.error(detail)
    console.error(
      "\nCe n'est pas un drift : vérifie que `psql` est installé, que la base répond et que SUPABASE_DB_URL est correct.",
    )
    process.exit(2)
  }

  const { remoteOnly, localOnly } = compareMigrationVersions(local, remote)

  console.log(`dépôt : ${local.length} migrations · base : ${remote.length} versions`)
  console.log(`base  : ${redactDbUrl(dbUrl)}`)

  if (remoteOnly.length > 0) {
    console.error(
      `\nDRIFT — ${remoteOnly.length} version(s) en base mais absentes du dépôt :`,
    )
    for (const version of remoteOnly) console.error(`  ${version}`)
    console.error(
      "\nUne migration a été appliquée hors dépôt (éditeur SQL). Avant tout",
    )
    console.error(
      "`supabase db push --include-all`, audite ses effets et réconcilie les deux",
    )
    console.error(
      "entrées d'historique : la version distante et la version locale canonique",
    )
    console.error(
      "qui porte le même changement. Copier la migration sous l'horodatage distant",
    )
    console.error(
      "et marquer celui-ci appliqué laisse la version locale en attente — un push",
    )
    console.error(
      "ultérieur peut alors rejouer un backfill destructif. Relis le `--dry-run`",
    )
    console.error("après réconciliation, pas avant.")
    process.exit(1)
  }

  if (localOnly.length > 0) {
    console.log(
      `\n${localOnly.length} migration(s) du dépôt pas encore en base (normal, push manuel) :`,
    )
    for (const version of localOnly) console.log(`  ${version}`)
  }

  console.log("\nOK — aucune version en base hors du dépôt.")
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
