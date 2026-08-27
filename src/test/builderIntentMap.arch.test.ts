import { describe, expect, it } from "vitest"
import dayEditor from "@/components/builder/DayEditor.tsx?raw"
import dayIntentMap from "@/components/builder/DayIntentMap.tsx?raw"
import dayList from "@/components/builder/DayList.tsx?raw"
import dayIntentToHeatmap from "@/lib/programScore/dayIntentToHeatmap.ts?raw"
import toIntentDayFromDayItems from "@/lib/programScore/toIntentDayFromDayItems.ts?raw"
import { importsOf } from "@/test/imports"

const sources = {
  DayEditor: dayEditor,
  DayIntentMap: dayIntentMap,
  DayList: dayList,
  dayIntentToHeatmap,
  toIntentDayFromDayItems,
} as const

describe("builder intent map path", () => {
  it.each(Object.keys(sources))("%s does not import useAggregatedMuscles", (name) => {
    expect(importsOf(sources[name as keyof typeof sources], "useAggregatedMuscles")).toEqual(
      [],
    )
  })
})
