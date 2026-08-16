import type { QwDayItem } from "./validate.ts"

const CINDY_CATALOG_ITEM = { type: "circuit", benchmark_slug: "cindy" } as const

/** Named WODs from AMRAP_CLOSED_INTENT_RULES plus the cindy seed aliases. */
const CINDY_SEED_KEYS = ["cindy", "holland", "tom holland"] as const

function mentionsCindySeed(text: string | undefined): boolean {
  if (text == null || text.trim() === "") return false
  const normalized = text.trim().toLowerCase()
  return CINDY_SEED_KEYS.some((key) => {
    if (key.includes(" ")) return normalized.includes(key)
    const pattern = new RegExp(`(?:^|[^a-z0-9])${key}(?:[^a-z0-9]|$)`)
    return pattern.test(normalized)
  })
}

function circuitLabel(item: QwDayItem): string | undefined {
  if (typeof item === "string") return undefined
  return "label" in item ? item.label : undefined
}

export function replaceCatalogCircuits(
  items: QwDayItem[],
  focusAreas?: string,
): QwDayItem[] {
  const closedIntent =
    mentionsCindySeed(focusAreas) || items.some((item) => mentionsCindySeed(circuitLabel(item)))
  if (closedIntent) return [CINDY_CATALOG_ITEM]
  return items
}
