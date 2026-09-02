import type { TFunction } from "i18next"
import type { ProgramFacts } from "@/lib/programScore/types"

export function formatFactsLine(
  t: TFunction<"program">,
  facts: Pick<ProgramFacts, "dayCount" | "setCount" | "circuitCount">,
): string {
  return t("facts.line", {
    days: t("facts.days", { count: facts.dayCount }),
    sets: t("facts.sets", { count: facts.setCount }),
    circuits: t("facts.circuits", { count: facts.circuitCount }),
  })
}
