import { describe, it, expect } from "vitest"
import { act } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { useWeightUnit } from "./useWeightUnit"

describe("useWeightUnit", () => {
  describe("toDisplay", () => {
    it("returns kg value as-is when unit is kg", () => {
      const { result } = renderHookWithProviders(() => useWeightUnit())
      expect(result.current.toDisplay(100)).toBe(100)
    })

    it("converts kg to lbs when unit is lbs", () => {
      const { result } = renderHookWithProviders(() => useWeightUnit())
      act(() => result.current.setUnit("lbs"))
      expect(result.current.toDisplay(100)).toBeCloseTo(220.462, 2)
    })

    it("returns 0 for 0 kg in lbs mode", () => {
      const { result } = renderHookWithProviders(() => useWeightUnit())
      act(() => result.current.setUnit("lbs"))
      expect(result.current.toDisplay(0)).toBe(0)
    })
  })

  describe("toKg", () => {
    it("returns value as-is when unit is kg", () => {
      const { result } = renderHookWithProviders(() => useWeightUnit())
      expect(result.current.toKg(100)).toBe(100)
    })

    it("converts lbs value back to kg", () => {
      const { result } = renderHookWithProviders(() => useWeightUnit())
      act(() => result.current.setUnit("lbs"))
      expect(result.current.toKg(220.462)).toBeCloseTo(100, 2)
    })

    it("returns 0 for 0 in lbs mode", () => {
      const { result } = renderHookWithProviders(() => useWeightUnit())
      act(() => result.current.setUnit("lbs"))
      expect(result.current.toKg(0)).toBe(0)
    })
  })

  describe("formatWeight", () => {
    it("formats integer kg in EN", () => {
      const { result } = renderHookWithProviders(() => useWeightUnit())
      expect(result.current.formatWeight(40)).toBe("40 kg")
    })

    it("formats decimal kg in EN", () => {
      const { result } = renderHookWithProviders(() => useWeightUnit())
      expect(result.current.formatWeight(40.5)).toBe("40.5 kg")
    })

    it("formats lbs with 1 decimal in EN", () => {
      const { result } = renderHookWithProviders(() => useWeightUnit())
      act(() => result.current.setUnit("lbs"))
      expect(result.current.formatWeight(40)).toBe("88.2 lbs")
    })

    it("formats decimal kg in FR with comma separator", () => {
      const { result, i18nInstance } = renderHookWithProviders(() =>
        useWeightUnit(),
      )
      act(() => {
        i18nInstance.changeLanguage("fr")
      })
      expect(result.current.formatWeight(40.5)).toBe("40,5 kg")
    })

    it("formats lbs in FR with comma separator", () => {
      const { result, i18nInstance } = renderHookWithProviders(() =>
        useWeightUnit(),
      )
      act(() => {
        result.current.setUnit("lbs")
        i18nInstance.changeLanguage("fr")
      })
      expect(result.current.formatWeight(40)).toBe("88,2 lbs")
    })
  })

  describe("unit switching", () => {
    it("defaults to kg", () => {
      const { result } = renderHookWithProviders(() => useWeightUnit())
      expect(result.current.unit).toBe("kg")
    })

    it("switches to lbs and reflects in unit value", () => {
      const { result } = renderHookWithProviders(() => useWeightUnit())
      act(() => result.current.setUnit("lbs"))
      expect(result.current.unit).toBe("lbs")
    })

    it("conversions reflect the new unit after switch", () => {
      const { result } = renderHookWithProviders(() => useWeightUnit())
      expect(result.current.toDisplay(50)).toBe(50)
      expect(result.current.toKg(50)).toBe(50)

      act(() => result.current.setUnit("lbs"))
      expect(result.current.toDisplay(50)).toBeCloseTo(110.231, 2)
      expect(result.current.toKg(110.231)).toBeCloseTo(50, 2)
    })
  })
})
