import { describe, expect, it } from "vitest"
import { parseCatalogPreviewRow, parseCatalogSeedRow } from "./previewCatalogCircuit"

const VALID_ROW = {
  id: "catalog-1",
  slug: "zeus",
  label: "Zeus ⚡",
  aliases: [],
  rx: {
    mode: "amrap",
    cap_seconds: 1200,
    exercises: [{ exercise_id: "exercise-1", amount: 5, weight: 0 }],
  },
  tagline_fr: null,
  tagline_en: null,
}

describe("parseCatalogPreviewRow", () => {
  it("keeps a non-empty catalog label and drops rows whose label is missing or blank", () => {
    expect(parseCatalogPreviewRow(VALID_ROW)?.label).toBe("Zeus ⚡")
    expect(parseCatalogPreviewRow({ ...VALID_ROW, label: "  " })).toBeNull()
    const { label: _label, ...missingLabel } = VALID_ROW
    expect(parseCatalogPreviewRow(missingLabel)).toBeNull()
  })
})

describe("parseCatalogSeedRow", () => {
  it("keeps story and reference on a valid seed without widening a broken Rx", () => {
    const parsed = parseCatalogSeedRow({
      ...VALID_ROW,
      story_fr: "Cinq tractions.",
      story_en: "Five pull-ups.",
      reference: { name: "Tom Holland", score: "27" },
    })

    expect(parsed).toEqual({
      id: "catalog-1",
      slug: "zeus",
      label: "Zeus ⚡",
      aliases: [],
      rx: VALID_ROW.rx,
      tagline_fr: null,
      tagline_en: null,
      story_fr: "Cinq tractions.",
      story_en: "Five pull-ups.",
      reference: { name: "Tom Holland", score: "27" },
    })
    expect(parseCatalogSeedRow({ ...VALID_ROW, rx: { mode: "nope" } })).toBeNull()
    expect(
      parseCatalogSeedRow({
        ...VALID_ROW,
        reference: { name: "Tom Holland" },
      })?.reference,
    ).toBeNull()
  })
})
