import { useAtom } from "jotai"
import { useTranslation } from "react-i18next"
import { useCallback } from "react"
import { weightUnitAtom } from "@/store/atoms"
import { formatNumber } from "@/lib/formatters"

const LBS_PER_KG = 2.20462

export function useWeightUnit() {
  const [unit, setUnit] = useAtom(weightUnitAtom)
  const { i18n } = useTranslation()

  const toDisplay = useCallback(
    (kg: number): number => (unit === "lbs" ? kg * LBS_PER_KG : kg),
    [unit],
  )

  const toKg = useCallback(
    (value: number): number => (unit === "lbs" ? value / LBS_PER_KG : value),
    [unit],
  )

  const formatWeight = useCallback(
    (kg: number): string => {
      const displayed = toDisplay(kg)
      const decimals = unit === "lbs" ? 1 : Number.isInteger(displayed) ? 0 : 1
      const formatted = formatNumber(displayed, i18n.language, {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals,
      })
      return `${formatted} ${unit}`
    },
    [unit, toDisplay, i18n.language],
  )

  return { unit, setUnit, toDisplay, toKg, formatWeight } as const
}
