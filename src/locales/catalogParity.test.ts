import { describe, it, expect } from "vitest"

import { EQUIPMENT_TAXONOMY } from "@/lib/catalogTaxonomy"
import { MUSCLE_TAXONOMY } from "@/lib/trainingBalance"

import enCatalog from "./en/catalog.json"
import frCatalog from "./fr/catalog.json"

type TableName = "muscles" | "equipment"

// Imported, never restated: a copy here would drift from the values the app
// actually stores, and the test would then certify itself.
const canonical: Record<TableName, readonly string[]> = {
  muscles: MUSCLE_TAXONOMY,
  equipment: EQUIPMENT_TAXONOMY,
}

const catalogs: Record<string, Record<TableName, Record<string, string>>> = {
  en: enCatalog,
  fr: frCatalog,
}

const cases = Object.keys(catalogs).flatMap((locale) =>
  (Object.keys(canonical) as TableName[]).map((table) => ({ locale, table })),
)

describe("catalog taxonomy coverage", () => {
  it.each(cases)("$locale translates every $table value", ({ locale, table }) => {
    const translated = catalogs[locale][table]
    const missing = canonical[table].filter((value) => !(value in translated))

    expect(missing).toEqual([])
  })

  it.each(cases)("$locale has no orphan $table key", ({ locale, table }) => {
    const known = new Set(canonical[table])
    const orphans = Object.keys(catalogs[locale][table]).filter(
      (key) => !known.has(key),
    )

    expect(orphans).toEqual([])
  })
})
