import { describe, it, expect } from "vitest"

/**
 * Guards for the failure mode ADR 0010 documented: a display surface that
 * forgets the resolver keeps rendering French, which is invisible to a
 * French-speaking reviewer. Neither of these can be caught by reading a diff.
 */

const componentSources = import.meta.glob("../components/**/*.{ts,tsx}", {
  query: "?raw",
  eager: true,
  import: "default",
}) as Record<string, string>

const migrationSources = import.meta.glob("../../supabase/migrations/*.sql", {
  query: "?raw",
  eager: true,
  import: "default",
}) as Record<string, string>

const repoPath = (globKey: string) =>
  globKey.startsWith("../../")
    ? globKey.slice("../../".length)
    : `src/${globKey.slice("../".length)}`

/**
 * Blanks out string literals before the scan. Without this, the i18n key
 * `t("blockRunner.instructions")` reads as an instruction access and the guard
 * cries wolf at a component that renders no instructions at all.
 */
const code = (source: string) =>
  source.replace(/"[^"\n]*"|'[^'\n]*'|`[^`]*`/g, '""')

/**
 * The files that legitimately read the raw blocks. The first two edit or count
 * the *source* content in admin. The last two are the translation review
 * screen, the one place whose job is to show both sides unresolved: running it
 * through the resolver would render a `flagged` row as French and hide the very
 * translation the reviewer was summoned to arbitrate. The assist dialog is on
 * that screen for the same reason — it diffs the stored English against a
 * proposed correction, and a resolved block would diff the French.
 *
 * Listed rather than pattern-matched so that adding one is a deliberate act.
 */
const FRENCH_SOURCE_READERS = [
  "src/components/admin/exercise-form/transforms.ts",
  "src/components/admin/exercises-table/columns.tsx",
  "src/components/admin/translations/ReviewAssistDialog.tsx",
  "src/components/admin/translations/TranslationReviewCard.tsx",
]

describe("instruction reads in components", () => {
  it("routes every display surface through the resolver", () => {
    const readers = Object.entries(componentSources)
      .filter(([path]) => !/\.test\.tsx?$/.test(path))
      .filter(([, source]) => /\.instructions\w*/.test(code(source)))
      .map(([path]) => repoPath(path))
      .sort()

    expect(readers).toEqual(FRENCH_SOURCE_READERS)
  })
})

describe("search_exercises", () => {
  // SwapExerciseSheet hands a paginated row straight to ExerciseDetailSheet
  // without refetching by id, so this RPC is the only path carrying the English
  // columns to that surface. It does so purely because it returns whole rows.
  // Asserting it against a live database would need one; this is the strongest
  // static statement of the same property.
  const definitions = Object.entries(migrationSources)
    .filter(([, sql]) => /FUNCTION\s+search_exercises\s*\(/.test(sql))
    .sort(([a], [b]) => a.localeCompare(b))

  const [path, sql] = definitions[definitions.length - 1] ?? []

  it("is defined exactly where this guard expects it", () => {
    expect(repoPath(path ?? "")).toBe(
      "supabase/migrations/20260326120000_search_exercises.sql",
    )
  })

  it("returns whole exercise rows, so new columns flow without a migration", () => {
    expect(sql).toMatch(/RETURNS SETOF exercises/)
  })

  it("projects e.* rather than an explicit column list", () => {
    const projections = [
      ...(sql ?? "").matchAll(/RETURN QUERY\s+SELECT\s+([^\n]+)/g),
    ].map(([, projection]) => projection.trim())

    expect(projections).toEqual(["e.*", "e.*"])
  })

  it("carries the English instruction columns, which sit on exercises", () => {
    const added = Object.values(migrationSources).flatMap((migration) =>
      [
        ...migration.matchAll(
          /ALTER TABLE exercises\s+ADD COLUMN IF NOT EXISTS\s+(\w+)/g,
        ),
      ].map(([, column]) => column),
    )

    expect(added).toEqual(
      expect.arrayContaining(["instructions_en", "instructions_en_status"]),
    )
  })
})
