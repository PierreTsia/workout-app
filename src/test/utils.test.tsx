import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import { useTranslation } from "react-i18next"

import { createTestI18n, renderWithProviders } from "./utils"

// The harness duplicates the namespace list that lives in src/lib/i18n.ts, so
// derive the expectation from the locale files themselves rather than from a
// third hand-maintained list.
const localeFilePaths = Object.keys(
  import.meta.glob("../locales/*/*.json", { eager: false }),
)

const namespacesOnDisk = localeFilePaths.reduce<Record<string, string[]>>(
  (acc, path) => {
    const [, locale, namespace] =
      /\/locales\/([^/]+)\/(.+)\.json$/.exec(path) ?? []
    return locale && namespace
      ? { ...acc, [locale]: [...(acc[locale] ?? []), namespace] }
      : acc
  },
  {},
)

function Label() {
  const { t } = useTranslation("common")
  return <span>{t("cancel")}</span>
}

describe("createTestI18n", () => {
  it("defaults to English so existing tests are unaffected", () => {
    const i18n = createTestI18n()

    expect(i18n.language).toBe("en")
    expect(i18n.t("cancel", { ns: "common" })).toBe("Cancel")
  })

  it("renders French when asked", () => {
    const i18n = createTestI18n({ lng: "fr" })

    expect(i18n.language).toBe("fr")
    expect(i18n.t("cancel", { ns: "common" })).toBe("Annuler")
  })

  it("keeps the English fallback real, as in production", () => {
    const i18n = createTestI18n({ lng: "fr" })

    expect(i18n.options.fallbackLng).toContain("en")
  })

  it.each(Object.keys(namespacesOnDisk))(
    "loads every %s namespace that exists on disk",
    (locale) => {
      const loaded = Object.keys(
        createTestI18n().store.data[locale] ?? {},
      ).sort()

      expect(loaded).toEqual([...namespacesOnDisk[locale]].sort())
    },
  )

  it("covers the same namespaces in both locales", () => {
    expect([...namespacesOnDisk.fr].sort()).toEqual(
      [...namespacesOnDisk.en].sort(),
    )
  })
})

describe("renderWithProviders locale option", () => {
  it("renders English by default", () => {
    renderWithProviders(<Label />)

    expect(screen.getByText("Cancel")).toBeInTheDocument()
  })

  it("propagates the requested locale to the tree", () => {
    renderWithProviders(<Label />, { locale: "fr" })

    expect(screen.getByText("Annuler")).toBeInTheDocument()
  })
})
