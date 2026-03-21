import { cn } from "@/lib/utils"

/** ToggleGroupItem classes (includes data-[state=on] for selected state). */
export const RIR_TOGGLE_CLASSES: Record<string, string> = {
  "0": "border-red-500 text-red-400 data-[state=on]:bg-red-500 data-[state=on]:text-white",
  "1": "border-orange-500 text-orange-400 data-[state=on]:bg-orange-500 data-[state=on]:text-white",
  "2": "border-yellow-500 text-yellow-400 data-[state=on]:bg-yellow-500 data-[state=on]:text-white",
  "3": "border-green-500 text-green-400 data-[state=on]:bg-green-500 data-[state=on]:text-white",
  "4": "border-blue-500 text-blue-400 data-[state=on]:bg-blue-500 data-[state=on]:text-white",
}

const RIR_BADGE_BASE =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold tabular-nums"

const RIR_BADGE_BY_VALUE: Record<number, string> = {
  0: "border-red-500 text-red-400",
  1: "border-orange-500 text-orange-400",
  2: "border-yellow-500 text-yellow-400",
  3: "border-green-500 text-green-400",
  4: "border-blue-500 text-blue-400",
}

/** Read-only RIR pill for history tables (no toggle state). */
export function rirBadgeClassName(rir: number | null | undefined): string {
  if (rir === null || rir === undefined || Number.isNaN(rir)) {
    return cn(RIR_BADGE_BASE, "border-muted-foreground/40 text-muted-foreground")
  }
  const clamped = Math.max(0, Math.min(4, Math.round(rir)))
  return cn(RIR_BADGE_BASE, RIR_BADGE_BY_VALUE[clamped])
}
