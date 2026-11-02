import { describe, expect, it } from "vitest"

import { MUSCLE_TAXONOMY } from "@/lib/trainingBalance"
import enCatalog from "@/locales/en/catalog.json"

import { muscleLabel, resolveDisplayName, warningText } from "../../supabase/functions/mcp/lib/displayLabels"
import { formatProgramDetails, formatStatsSummary } from "../../supabase/functions/mcp/lib/format"

// T716 (#729) — the cross-surface guard. Each unit surface already has its own
// fixture (displayLabels, programPatchCard, formatProgramDetails, formatStatsSummary,
// daySequence, DayCard, warningText); this file adds the two properties none of
// them can state alone: the server muscle table cannot drift from the app's, and a
// whole reader's path stays French-free.

describe("server muscle table parity (T716)", () => {
  it("maps every canonical muscle exactly as en/catalog.json does", () => {
    const drift = MUSCLE_TAXONOMY.filter(
      (value) => muscleLabel(value, "en") !== enCatalog.muscles[value],
    )
    expect(drift).toEqual([])
  })

  it("keeps every canonical muscle in French for a French reader", () => {
    const drifted = MUSCLE_TAXONOMY.filter(
      (value) => muscleLabel(value, "fr") !== value,
    )
    expect(drifted).toEqual([])
  })

  it("passes an off-taxonomy value through untouched", () => {
    expect(muscleLabel("Deltoïdes post.", "en")).toBe("Deltoïdes post.")
  })
})

describe("English reader sees no French on the golden surfaces (T716)", () => {
  const FR = "Développé couché"
  const EN = "Bench Press"

  it("get_program_details renders the English name", () => {
    const md = formatProgramDetails(
      { id: "p", name: "PPL", archived_at: null },
      [{ id: "d", label: "Push", emoji: "💪", sort_order: 0 }],
      new Map([
        [
          "d",
          [
            {
              id: "e",
              exercise_id: "cccccccc-3333-4333-8333-333333333333",
              name_snapshot: FR,
              name: FR,
              name_en: EN,
              sets: 4,
              reps: "8",
              weight: "80",
              rest_seconds: 120,
              target_duration_seconds: null,
            },
          ],
        ],
      ]),
      undefined,
      "en",
    )
    expect(md).toContain(EN)
    expect(md).not.toContain(FR)
  })

  it("get_training_stats renders the English muscle label", () => {
    const md = formatStatsSummary(30, 4, [{ muscle_group: "Épaules", total_sets: 10, total_volume_kg: 500 }], [], "en")
    expect(md).toContain("Shoulders")
    expect(md).not.toContain("Épaules")
  })

  it("update_program warnings are English", () => {
    const text = warningText("slot_detachment", "en", { exercise: EN })
    expect(text).toContain(EN)
    expect(text).not.toMatch(/Historique détaché/)
  })

  it("negative control — a French snapshot read raw would leak (the guard is meaningful)", () => {
    // The snapshot fallback (catalog row absent) is French by design; this asserts
    // the resolver is the thing that flips it, so a surface that bypasses it shows
    // French — which is exactly what every fixture above would catch.
    expect(resolveDisplayName({ name_snapshot: FR }, "en")).toBe(FR)
    expect(resolveDisplayName({ name: FR, name_en: EN }, "en")).toBe(EN)
  })
})
