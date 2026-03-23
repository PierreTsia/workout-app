import { describe, it, expect } from "vitest"
import {
  getEquipmentValuesForCategories,
  toggleEquipmentCategory,
} from "./equipmentSelection"

describe("equipmentSelection", () => {
  it("unions equipment values for bodyweight and dumbbells", () => {
    const vals = getEquipmentValuesForCategories(["bodyweight", "dumbbells"])
    expect(vals.sort()).toEqual(["bodyweight", "dumbbell"].sort())
  })

  it("toggleEquipmentCategory selects full gym exclusively", () => {
    expect(toggleEquipmentCategory("full-gym", ["bodyweight"])).toEqual([
      "full-gym",
    ])
  })

  it("toggleEquipmentCategory leaves limited mode from full gym with one category", () => {
    expect(toggleEquipmentCategory("dumbbells", ["full-gym"])).toEqual([
      "dumbbells",
    ])
  })

  it("toggleEquipmentCategory adds second limited category", () => {
    expect(
      toggleEquipmentCategory("dumbbells", ["bodyweight"]),
    ).toEqual(["bodyweight", "dumbbells"])
  })

  it("toggleEquipmentCategory restores full gym when last limited is toggled off", () => {
    expect(toggleEquipmentCategory("dumbbells", ["dumbbells"])).toEqual([
      "full-gym",
    ])
  })
})
