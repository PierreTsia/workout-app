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
})

describe("importsOf", () => {
  // The case the previous regex missed: this is an i18next import, and the
  // whole purpose of a purity guard is to catch it.
  it("counts react-i18next as an i18next import", () => {
    const source = "import { useTranslation } from \"react-i18next\""

    expect(importsOf(source, "i18next")).toEqual(["react-i18next"])
    expect(importsOf(source, "react")).toEqual(["react-i18next"])
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
