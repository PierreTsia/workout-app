import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"

import { resolveCardLocale } from "./sessionCard.ts"

Deno.test("resolveCardLocale: prefers the explicit tool argument", () => {
  assertEquals(resolveCardLocale("fr", "en"), "fr")
  assertEquals(resolveCardLocale("en", "fr"), "en")
})

Deno.test("resolveCardLocale: falls back to the athlete's stored locale", () => {
  assertEquals(resolveCardLocale(undefined, "fr"), "fr")
})

Deno.test("resolveCardLocale: defaults to English for anything unusable", () => {
  assertEquals(resolveCardLocale(undefined, null), "en")
  assertEquals(resolveCardLocale("de", "es"), "en")
  assertEquals(resolveCardLocale(42, {}), "en")
})
