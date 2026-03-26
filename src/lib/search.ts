/**
 * Strips diacritics and lowercases text for search comparison.
 * "Développé" → "developpe", "Écarté" → "ecarte"
 */
export function normalizeForSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}
