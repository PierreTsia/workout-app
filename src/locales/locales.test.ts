import { describe, it, expect } from "vitest"

// Namespace coverage is asserted by the test harness (src/test/utils.test.tsx).
// This file asserts the stronger property the harness cannot see: that a key
// resolves in every locale. Without it, a key missing from `fr` silently falls
// back to English and the gap is invisible until a user reports it.
const localeModules = import.meta.glob("./*/*.json", { eager: true }) as Record<
  string,
  { default: Record<string, unknown> }
>

const flatten = (
  value: Record<string, unknown>,
  prefix = "",
): [string, unknown][] =>
  Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return child !== null && typeof child === "object"
      ? flatten(child as Record<string, unknown>, path)
      : [[path, child] as [string, unknown]]
  })

const valuesByLocale = Object.entries(localeModules).reduce<
  Record<string, Record<string, unknown>>
>((acc, [path, module]) => {
  const [, locale, namespace] = /^\.\/([^/]+)\/(.+)\.json$/.exec(path) ?? []
  if (!locale || !namespace) return acc

  const namespaced = Object.fromEntries(
    flatten(module.default).map(([key, value]) => [
      `${namespace}:${key}`,
      value,
    ]),
  )

  return { ...acc, [locale]: { ...(acc[locale] ?? {}), ...namespaced } }
}, {})

const locales = Object.keys(valuesByLocale).sort()

const allKeys = [
  ...new Set(locales.flatMap((locale) => Object.keys(valuesByLocale[locale]))),
].sort()

const sharedKeys = allKeys.filter((key) =>
  locales.every((locale) => key in valuesByLocale[locale]),
)

// i18next reads `{{name}}`, `{{count}}` and formatted variants like
// `{{value, number}}` — only the variable name matters for parity.
const placeholders = (value: unknown): string =>
  typeof value === "string"
    ? [...value.matchAll(/\{\{\s*([^}\s,]+)/g)]
        .map((match) => match[1])
        .sort()
        .join(",")
    : ""

describe("locale parity", () => {
  it("discovers more than one locale, otherwise it proves nothing", () => {
    expect(locales.length).toBeGreaterThan(1)
    expect(allKeys.length).toBeGreaterThan(0)
  })

  it.each(locales)("%s defines every key found in another locale", (locale) => {
    const missing = allKeys.filter((key) => !(key in valuesByLocale[locale]))

    expect(missing).toEqual([])
  })

  it("uses the same interpolation variables for a key in every locale", () => {
    const divergent = sharedKeys
      .map((key) => ({
        key,
        byLocale: locales.map((locale) => ({
          locale,
          variables: placeholders(valuesByLocale[locale][key]),
        })),
      }))
      .filter(
        ({ byLocale }) =>
          new Set(byLocale.map(({ variables }) => variables)).size > 1,
      )
      .map(
        ({ key, byLocale }) =>
          `${key} — ${byLocale
            .map(({ locale, variables }) => `${locale}: [${variables}]`)
            .join(" vs ")}`,
      )

    expect(divergent).toEqual([])
  })

  it("never leaves a key blank in one locale only", () => {
    const blank = sharedKeys.filter((key) =>
      locales.some(
        (locale) =>
          typeof valuesByLocale[locale][key] === "string" &&
          (valuesByLocale[locale][key] as string).trim() === "",
      ),
    )

    expect(blank).toEqual([])
  })
})
