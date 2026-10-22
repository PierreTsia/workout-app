/**
 * Detect migration-history drift: a version applied to the database but absent
 * from the repo — the 21/10 incident, where five migrations went through the SQL
 * editor and the prod history no longer matched `supabase/migrations/`.
 *
 *   npm run db:drift
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
const DEFAULT_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

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
  const dbUrl = process.env.SUPABASE_DB_URL ?? DEFAULT_DB_URL
  const local = readLocalVersions()

  let remote: string[]
  try {
    remote = readRemoteVersions(dbUrl)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error(`\nImpossible de lire l'historique des migrations dans la base (${dbUrl}).`)
    console.error(detail)
    console.error(
      "\nCe n'est pas un drift : vérifie que `psql` est installé, que la base répond et que SUPABASE_DB_URL est correct.",
    )
    process.exit(2)
  }

  const { remoteOnly, localOnly } = compareMigrationVersions(local, remote)

  console.log(`dépôt : ${local.length} migrations · base : ${remote.length} versions`)
  console.log(`base  : ${dbUrl}`)

  if (remoteOnly.length > 0) {
    console.error(
      `\nDRIFT — ${remoteOnly.length} version(s) en base mais absentes du dépôt :`,
    )
    for (const version of remoteOnly) console.error(`  ${version}`)
    console.error(
      "\nUne migration a été appliquée hors dépôt (éditeur SQL). La remettre dans",
    )
    console.error(
      "supabase/migrations/ puis `supabase migration repair --status applied <version>`",
    )
    console.error("avant tout `supabase db push --include-all`.")
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
