import { useMemo } from "react"
import Model from "react-body-highlighter"
import type { IExerciseData } from "react-body-highlighter"
import { buildSingleExerciseData } from "@/lib/muscleMapping"

const BODY_COLOR = "hsl(var(--muted))"
const HIGHLIGHTED_COLORS = [
  "hsl(var(--primary) / 0.3)",
  "hsl(var(--primary) / 0.65)",
  "hsl(var(--primary))",
]

/** Seven-step ramp for volume-weighted maps (must stay in sync with BODY_MAP_VOLUME_BUCKET_COUNT). */
export const BODY_MAP_INTENSITY_COLORS = [
  "hsl(var(--primary) / 0.18)",
  "hsl(var(--primary) / 0.30)",
  "hsl(var(--primary) / 0.44)",
  "hsl(var(--primary) / 0.56)",
  "hsl(var(--primary) / 0.70)",
  "hsl(var(--primary) / 0.84)",
  "hsl(var(--primary))",
] as const

interface BodyMapProps {
  /** Pre-built data array (aggregated mode) — takes precedence over muscleGroup */
  data?: IExerciseData[]
  /** Primary muscle (single exercise mode, ignored when data is provided) */
  muscleGroup?: string
  /** Secondary muscles (single exercise mode) */
  secondaryMuscles?: string[] | null
  /**
   * Colors by intensity; library indexes with `frequency` (1 = first color).
   * Use `BODY_MAP_INTENSITY_COLORS` when `data` uses bucketed frequencies (e.g. Balance tab).
   */
  highlightedColors?: readonly string[]
  className?: string
}

/**
 * Renders anterior + posterior body silhouettes side-by-side,
 * highlighting muscles based on the provided data or single-exercise fields.
 */
export function BodyMap({
  data,
  muscleGroup,
  secondaryMuscles,
  highlightedColors,
  className,
}: BodyMapProps) {
  const exerciseData = useMemo(() => {
    if (data) return data
    if (muscleGroup) return buildSingleExerciseData(muscleGroup, secondaryMuscles)
    return []
  }, [data, muscleGroup, secondaryMuscles])

  const colors = highlightedColors ?? HIGHLIGHTED_COLORS

  return (
    <div className={`flex items-center justify-center gap-2 ${className ?? ""}`}>
      <Model
        data={exerciseData}
        type="anterior"
        bodyColor={BODY_COLOR}
        highlightedColors={[...colors]}
        style={{ width: "100%", maxWidth: "140px" }}
      />
      <Model
        data={exerciseData}
        type="posterior"
        bodyColor={BODY_COLOR}
        highlightedColors={[...colors]}
        style={{ width: "100%", maxWidth: "140px" }}
      />
    </div>
  )
}
