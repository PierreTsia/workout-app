import { describe, it, expect } from "vitest"

/**
 * PR #442 closed the SECURITY DEFINER holes that existed on the day it was
 * written (#440). It does nothing about the next one. A SECURITY DEFINER
 * function runs as its owner and reads straight past RLS, so the only thing
 * between a caller and everybody else's rows is a check inside the body — and
 * the whole finding in #440 was that route guards in the React app had been
 * mistaken for that check.
 *
 * This sweeps every migration and refuses to let a new unguarded one land.
 *
 * What it can and cannot say: it proves an authorization signal is *present*,
 * not that it is *correct*. The fail-open guard #440 found —
 * `auth.uid() IS NOT NULL AND auth.uid() <> p_user_id`, which admits every
 * keyless caller — would satisfy this test, because it is a real comparison
 * against a real user column. Judging whether a guard holds stays a human job.
 * This only guarantees there is something for the human to judge.
 */

const migrationSources = import.meta.glob("../../supabase/migrations/*.sql", {
  query: "?raw",
  eager: true,
  import: "default",
}) as Record<string, string>

const repoPath = (globKey: string) => globKey.slice("../../".length)

/**
 * Line comments only. `supabase/migrations/` contains no C-style comment blocks
 * and no `--` inside a string literal; either would need real lexing rather
 * than a replace, and would make this scan understate the surface it covers.
 * The migration in #442 argues for itself in 90 lines of prose containing the
 * words SECURITY DEFINER eight times, so scanning comments is not an option.
 */
const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, "")

const FUNCTION_HEAD = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s/i

type FunctionStatement = {
  readonly name: string
  readonly file: string
  /** The declared parameter list, normalized, for the overload check below. */
  readonly signature: string
  /** Everything from `CREATE` up to the opening `$$`. */
  readonly header: string
  /** Everything between the `$$` delimiters. */
  readonly body: string
  /** Everything from the closing `$$` to the terminating `;`. */
  readonly trailer: string
}

/**
 * Postgres accepts the attribute clauses on either side of the body —
 * `20260405120000_transactional_email.sql` writes `$$ LANGUAGE plpgsql;` — so
 * SECURITY DEFINER and SET search_path have to be looked for in both.
 */
const attributes = (statement: FunctionStatement) =>
  `${statement.header}\n${statement.trailer}`

/**
 * Split on the statement boundary, then cut each chunk on its `$$` delimiters.
 * Every body in this directory is delimited by a bare `$$`; no named `$tag$` is
 * in use. Cutting on delimiters rather than matching a whole statement with one
 * regex keeps the parameter list, the RETURNS TABLE column list and the body
 * out of each other's way — all three contain commas and parentheses.
 */
const parseFunctions = (path: string, sql: string): FunctionStatement[] =>
  sql
    .split(new RegExp(`(?=${FUNCTION_HEAD.source})`, "i"))
    .filter((chunk) => new RegExp(`^${FUNCTION_HEAD.source}`, "i").test(chunk))
    .map((chunk) => {
      const open = chunk.indexOf("$$")
      const close = chunk.indexOf("$$", open + 2)
      const terminator = chunk.indexOf(";", close + 2)
      const header = open === -1 ? chunk : chunk.slice(0, open)

      return {
        name: /FUNCTION\s+(?:public\.)?(\w+)/i.exec(chunk)?.[1] ?? "",
        file: repoPath(path),
        signature: header
          .slice(0, header.search(/\bRETURNS\b/i))
          .replace(FUNCTION_HEAD, "")
          .replace(/\bpublic\./i, "")
          .replace(/\s+/g, " ")
          .trim(),
        header,
        body: open === -1 || close === -1 ? "" : chunk.slice(open + 2, close),
        trailer:
          close === -1
            ? ""
            : chunk.slice(close + 2, terminator === -1 ? undefined : terminator),
      }
    })

/**
 * Migration filenames are `<version>_<slug>.sql`, so lexicographic order is
 * apply order, and a file's chunks come out in the order they run.
 */
const statements = Object.entries(migrationSources)
  .sort(([a], [b]) => a.localeCompare(b))
  .flatMap(([path, sql]) => parseFunctions(path, stripComments(sql)))

/**
 * THE ORDERING RULE, and the subtle part of this file.
 *
 * A function can be created insecurely and hardened later by a
 * `CREATE OR REPLACE` in a newer migration — which is exactly what PR #442 did
 * to five of these. Only the *last* definition survives in the database, so
 * only the last one may be asserted on. Asserting on every definition would
 * fail over history that no longer exists; asserting on the first would miss
 * every fix. The reverse case matters just as much: a function hardened in one
 * migration and replaced by a careless copy-paste in a later one is a
 * regression this test has to catch, and only last-wins catches it.
 *
 * `new Map(entries)` keeps the last value for a repeated key, and `statements`
 * is already in apply order, so this line is that rule and nothing else.
 *
 * Keyed on the bare name, not the full signature. Postgres identifies a
 * function by name *and* argument types, so two overloads would collapse into
 * one entry here and hide the un-hardened twin. No function in this repo is
 * overloaded; the parameter-list assertion below is what keeps that true.
 */
const effectiveDefinitions = new Map(
  statements.map((statement) => [statement.name, statement] as const),
)

const securityDefiners = [...effectiveDefinitions.values()]
  .filter((statement) => /\bSECURITY\s+DEFINER\b/i.test(attributes(statement)))
  .sort((a, b) => a.name.localeCompare(b.name))

/**
 * Recognized authorization signals, named so a failure reports which kind of
 * check was looked for rather than dumping a regex at the reader.
 */
const AUTHORIZATION_SIGNALS: ReadonlyArray<readonly [string, RegExp]> = [
  [
    "auth.uid() compared against a user column",
    /auth\.uid\(\)\s*(?:=|<>)|(?:=|<>)\s*auth\.uid\(\)/i,
  ],
  ["admin_users membership", /\badmin_users\b/i],
  ["is_trusted_backend_caller()", /\bis_trusted_backend_caller\s*\(\s*\)/i],
  [
    "RAISE ... USING ERRCODE = 'insufficient_privilege'",
    /ERRCODE\s*=\s*'insufficient_privilege'/i,
  ],
  ["auth.role() / auth.jwt() claim check", /auth\.(?:role|jwt)\(\)/i],
]

const signalsIn = (statement: FunctionStatement) =>
  AUTHORIZATION_SIGNALS.filter(([, pattern]) =>
    pattern.test(statement.body),
  ).map(([label]) => label)

const SECURITY_DEFINER_FUNCTIONS = [
  "check_and_grant_achievements",
  "get_badge_status",
  "get_cycle_stats",
  "get_exercise_filter_options",
  "get_translations_for_review",
  "get_unreviewed_exercises_by_usage",
  "get_volume_by_muscle_group",
  "validate_title_ownership",
]

/**
 * SECURITY DEFINER functions that carry no in-body authorization check, and the
 * reason each is allowed not to. Adding a name here is a security decision, so
 * it costs a line of justification.
 *
 * - get_exercise_filter_options: reads nothing but `exercises`, whose SELECT
 *   policy is `USING (true)` for PUBLIC, so there is no per-user notion to
 *   check and definer rights buy the caller no reach it lacks — the same three
 *   lists come out of GET /rest/v1/exercises.
 * - validate_title_ownership: a trigger function. Postgres refuses a direct
 *   call and PostgREST does not expose RETURNS trigger over /rpc, so it has no
 *   caller to authorize; the ownership check it makes on NEW.user_id is the
 *   purpose of the function rather than a gate on it.
 */
const UNGUARDED_BY_DESIGN = [
  "get_exercise_filter_options",
  "validate_title_ownership",
]

/**
 * SECURITY DEFINER functions whose effective definition does not pin
 * `search_path`. That is a privilege-escalation vector rather than a style
 * nit: owner rights plus a caller-influenced resolution order lets a shadowing
 * schema substitute its own `exercises` or `admin_users` under the function.
 *
 * Empty, and it should stay that way. `get_unreviewed_exercises_by_usage` was
 * the one offender — created without it in 20260414000000 — and PR #442's
 * redefinition supplied it. That repair is only visible through the ordering
 * rule above, which is a decent argument for the rule.
 */
const MISSING_SEARCH_PATH: string[] = []

describe("migration parsing", () => {
  // A regex sweep over SQL that quietly matches nothing is the failure mode to
  // fear here: it reports green forever and nobody looks again. These three say
  // the sweep reached every statement and cut each one where it meant to.
  it("finds every CREATE FUNCTION statement in the migrations directory", () => {
    const declared = Object.values(migrationSources)
      .map(stripComments)
      .flatMap((sql) => [
        ...sql.matchAll(new RegExp(FUNCTION_HEAD.source, "gi")),
      ]).length

    expect(statements).toHaveLength(declared)
    expect(statements.length).toBeGreaterThan(0)
  })

  it("delimits a body for every one of them", () => {
    const bodyless = statements
      .filter((statement) => statement.body.trim() === "")
      .map((statement) => `${statement.file}: ${statement.name}`)

    expect(bodyless).toEqual([])
  })

  it("recovers the LANGUAGE clause for every one of them", () => {
    // Independent of the cut: every Postgres function must declare a LANGUAGE
    // and it sits outside the body, so a misaligned header/trailer slice shows
    // up here rather than as a silently empty scan.
    //
    // The optional quotes are not decoration. 20260314000003 writes
    // `$$ language 'plpgsql';` — the legacy quoted form, still accepted — and
    // an unquoted-only pattern reports it as unparsed.
    const unrecognized = statements
      .filter(
        (statement) =>
          !/\bLANGUAGE\s+'?(?:sql|plpgsql)'?/i.test(attributes(statement)),
      )
      .map((statement) => `${statement.file}: ${statement.name}`)

    expect(unrecognized).toEqual([])
  })

  it("sees one parameter list per function, so name-keying is sound", () => {
    // An overload — same name, different argument types — is a second function
    // in Postgres, and the map above would keep only one of the two. If this
    // ever fails, the fix is to key effectiveDefinitions on the signature, not
    // to delete the assertion.
    const overloaded = [...new Set(statements.map(({ name }) => name))]
      .filter(
        (name) =>
          new Set(
            statements
              .filter((statement) => statement.name === name)
              .map(({ signature }) => signature),
          ).size > 1,
      )
      .sort()

    expect(overloaded).toEqual([])
  })
})

describe("SECURITY DEFINER functions", () => {
  it("are exactly this set", () => {
    expect(securityDefiners.map(({ name }) => name)).toEqual(
      SECURITY_DEFINER_FUNCTIONS,
    )
  })

  it("each carry an authorization check in the body", () => {
    const unguarded = securityDefiners
      .filter((statement) => signalsIn(statement).length === 0)
      .map(({ name }) => name)

    expect(unguarded).toEqual(UNGUARDED_BY_DESIGN)
  })

  it("each pin search_path against schema shadowing", () => {
    const unpinned = securityDefiners
      .filter(
        (statement) => !/\bSET\s+search_path\s*=/i.test(attributes(statement)),
      )
      .map(({ name }) => name)

    expect(unpinned).toEqual(MISSING_SEARCH_PATH)
  })

  it("keep the waiver list free of names that no longer exist", () => {
    // Otherwise a function can be renamed out from under its own waiver, and
    // the rename inherits the exemption in silence.
    const stale = UNGUARDED_BY_DESIGN.filter(
      (name) => !SECURITY_DEFINER_FUNCTIONS.includes(name),
    )

    expect(stale).toEqual([])
  })
})

/**
 * #444: `REVOKE ... FROM PUBLIC` does not remove Supabase's explicit `anon`
 * grant. Supabase sets `ALTER DEFAULT PRIVILEGES ... GRANT EXECUTE ON FUNCTIONS
 * TO anon, authenticated, service_role` at project creation, so every fresh
 * CREATE FUNCTION receives an explicit `anon=X` ACL entry, separate from the
 * implicit PUBLIC one. A migration that revokes only PUBLIC therefore leaves
 * `anon` able to EXECUTE a SECURITY DEFINER function on a database rebuilt from
 * migrations — even though prod, patched by hand during the #439 incident, does
 * not. Not exploitable (the bodies fail closed for anon), but an
 * environment-reproducibility defect.
 *
 * The grant lives in the database, not in the SQL, so this is a static
 * assertion over the migration files: every SECURITY DEFINER function must be
 * named in a REVOKE that lists `anon`, and no GRANT may hand EXECUTE back to it.
 * The revoke may live in any migration, not only the one that defines the
 * function — the #444 fix is a later, idempotent sweep rather than an edit to
 * already-applied history.
 */
/** Naming `anon`, or `public` (which includes it), restores anonymous access. */
const REACHES_ANON = new Set(["anon", "public"])

const grantees = (list: string) =>
  list.split(",").map((role) => role.trim().toLowerCase())

const reachesAnon = (list: string) =>
  grantees(list).some((role) => REACHES_ANON.has(role))

/** Apply order, so a revoke can be required at-or-after the effective definition. */
const orderedMigrationPaths = Object.keys(migrationSources).sort((a, b) =>
  a.localeCompare(b),
)
const migrationIndex = new Map(
  orderedMigrationPaths.map((path, i) => [repoPath(path), i] as const),
)

const revokeAnon = (name: string) =>
  new RegExp(
    // `REVOKE EXECUTE` and `REVOKE ALL` both strip EXECUTE.
    `REVOKE\\s+(?:EXECUTE|ALL)\\s+ON\\s+FUNCTION\\s+(?:public\\.)?${name}\\s*\\([^)]*\\)\\s+FROM\\s+([^;]+);`,
    "gi",
  )

/**
 * Every GRANT form that hands EXECUTE to a role — over a named function, over
 * all functions in a schema, or as an `ALTER DEFAULT PRIVILEGES` default (the
 * exact clause Supabase uses to reintroduce the `anon=X` grant on a fresh
 * CREATE FUNCTION). `GRANT ALL [PRIVILEGES]` grants EXECUTE too.
 */
const GRANTS_REACHING_ANON = [
  /\bGRANT\s+(?:EXECUTE|ALL(?:\s+PRIVILEGES)?)\s+ON\s+(?:FUNCTION|ALL\s+FUNCTIONS\s+IN\s+SCHEMA)\b[^;]*?\bTO\s+([^;]+);/gi,
  /\bALTER\s+DEFAULT\s+PRIVILEGES\b[^;]*?\bGRANT\s+(?:EXECUTE|ALL(?:\s+PRIVILEGES)?)\s+ON\s+FUNCTIONS\b[^;]*?\bTO\s+([^;]+);/gi,
]

/**
 * A revoke only counts at or after the function's effective definition: a later
 * `DROP FUNCTION` + `CREATE FUNCTION` recreates the Supabase default `anon=X`
 * grant, so an earlier revoke is stale. Same-file revokes must also come *after*
 * the definition within that file.
 */
const anonRevokedAtOrAfterDefinition = (statement: FunctionStatement) => {
  const start = migrationIndex.get(statement.file)
  if (start === undefined) return false

  for (let i = start; i < orderedMigrationPaths.length; i++) {
    let sql = stripComments(migrationSources[orderedMigrationPaths[i]])
    if (i === start) {
      const head = new RegExp(
        `CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+(?:public\\.)?${statement.name}\\b`,
        "gi",
      )
      const last = [...sql.matchAll(head)].pop()
      sql = last?.index === undefined ? "" : sql.slice(last.index)
    }
    if (
      [...sql.matchAll(revokeAnon(statement.name))].some(([, list]) =>
        reachesAnon(list),
      )
    ) {
      return true
    }
  }
  return false
}

const allMigrationSql = orderedMigrationPaths
  .map((path) => stripComments(migrationSources[path]))
  .join("\n")

describe("SECURITY DEFINER functions revoke anon by name (#444)", () => {
  it("names anon in a REVOKE at or after each function's effective definition", () => {
    const missing = securityDefiners
      .filter((statement) => !anonRevokedAtOrAfterDefinition(statement))
      .map((statement) => statement.name)

    expect(missing).toEqual([])
  })

  it("never grants EXECUTE to anon (or public) on any function", () => {
    const offenders = GRANTS_REACHING_ANON.flatMap((pattern) =>
      [...allMigrationSql.matchAll(pattern)]
        .filter(([, list]) => reachesAnon(list))
        .map(([match]) => match.replace(/\s+/g, " ").trim()),
    )

    expect(offenders).toEqual([])
  })
})

/**
 * #482 / T210: the circuit achievement migration must keep the five metric
 * branches, seed-only join (`owner_id IS NULL`), Cast Clearing slug lists, and
 * the LEFT JOIN / unnest pattern that yields 0 when a seed is missing.
 * Auth-guard coverage for both RPCs stays in the suite above (last-wins).
 */
const CIRCUIT_ACHIEVEMENT_METRICS = [
  "circuit_runner",
  "spidey",
  "olympians",
  "heroes",
  "pantheoniste",
] as const

const CAST_CLEARING_SLUGS = [
  "zeus",
  "ares",
  "athena",
  "hades",
  "heracles",
  "theseus",
  "atlas",
  "achilles",
] as const

const circuitAchievementMigration = Object.entries(migrationSources).find(
  ([path]) => path.includes("circuit_achievement_tracks"),
)

const circuitAchievementSql = circuitAchievementMigration?.[1] ?? ""

describe("circuit achievement tracks migration (#482 / T210)", () => {
  it("ships the circuit_achievement_tracks migration", () => {
    expect(circuitAchievementMigration).toBeDefined()
  })

  it("keeps both achievement RPCs on the SECURITY DEFINER roster", () => {
    expect(SECURITY_DEFINER_FUNCTIONS).toEqual(
      expect.arrayContaining([
        "check_and_grant_achievements",
        "get_badge_status",
      ]),
    )
  })

  it("pins the five circuit metric_type literals", () => {
    const missing = CIRCUIT_ACHIEVEMENT_METRICS.filter(
      (metric) => !circuitAchievementSql.includes(`'${metric}'`),
    )

    expect(missing).toEqual([])
  })

  it("keeps the seed-only owner_id IS NULL guard on the circuit join path", () => {
    const sql = stripComments(circuitAchievementSql)
    const seedJoins = [
      ...sql.matchAll(
        /JOIN\s+benchmark_circuits\s+\w+\s+ON[\s\S]*?owner_id\s+IS\s+NULL/gi,
      ),
    ]

    // Both check_and_grant_achievements and get_badge_status must keep the guard.
    expect(seedJoins).toHaveLength(2)
  })

  it("pins Cast Clearing fixed slugs and the LEFT JOIN / unnest pattern", () => {
    const missingSlugs = CAST_CLEARING_SLUGS.filter(
      (slug) => !circuitAchievementSql.includes(`'${slug}'`),
    )

    expect(missingSlugs).toEqual([])
    expect(circuitAchievementSql).toMatch(
      /unnest\s*\(\s*ARRAY\s*\[\s*'zeus'\s*,\s*'ares'\s*,\s*'athena'\s*,\s*'hades'\s*\]\s*\)/i,
    )
    expect(circuitAchievementSql).toMatch(
      /unnest\s*\(\s*ARRAY\s*\[\s*'heracles'\s*,\s*'theseus'\s*,\s*'atlas'\s*,\s*'achilles'\s*\]\s*\)/i,
    )
    expect(circuitAchievementSql).toMatch(
      /LEFT\s+JOIN\s+qualifying_runs\s+\w+\s+ON\s+\w+\.slug\s*=/i,
    )
  })
})
