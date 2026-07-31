import { describe, it, expect } from "vitest"
import { importedModules, importsOf } from "./imports"

describe("importedModules", () => {
  it("collects specifiers across quote styles", () => {
    const source = [
      'import { useMemo } from "react"',
      "import { useTranslation } from 'react-i18next'",
      'import { groupBy } from "@/lib/utils"',
    ].join("\n")

    expect(importedModules(source)).toEqual([
      "react",
      "react-i18next",
      "@/lib/utils",
    ])
  })

  it("ignores a module named in prose", () => {
    expect(importedModules("// i18next is deliberately absent here")).toEqual([])
  })

  // A bare import has no `from`, so a guard reading only `from "…"` lets it
  // through — and importing a module purely for its side effects is exactly how
  // React ends up in the graph of something that claims not to need it.
  it("collects side-effect imports", () => {
    expect(importedModules('import "@/lib/i18n"')).toEqual(["@/lib/i18n"])
  })

  it("collects dynamic imports", () => {
    expect(
      importedModules('const m = await import("react-i18next")'),
    ).toEqual(["react-i18next"])
  })

  it("collects re-exports", () => {
    expect(importedModules('export { useMemo } from "react"')).toEqual(["react"])
  })

  it("collects type-only imports", () => {
    expect(importedModules('import type { TFunction } from "i18next"')).toEqual([
      "i18next",
    ])
  })
})

describe("importsOf", () => {
  // The case the previous regex missed: this is an i18next import, and the
  // whole purpose of a purity guard is to catch it.
  it("counts react-i18next as an i18next import", () => {
    const source = "import { useTranslation } from \"react-i18next\""

    expect(importsOf(source, "i18next")).toEqual(["react-i18next"])
    expect(importsOf(source, "react")).toEqual(["react-i18next"])
  })

  it("counts a side-effect import of the i18n module", () => {
    expect(importsOf('import "@/lib/i18n"', "i18n")).toEqual(["@/lib/i18n"])
  })

  it("finds nothing in a pure module", () => {
    const source = [
      'import { formatDurationShort } from "@/lib/formatters"',
      'import type { SetLog } from "@/types/database"',
    ].join("\n")

    expect(importsOf(source, "react")).toEqual([])
    expect(importsOf(source, "i18next")).toEqual([])
  })
})
