export type ProgramExercisePreviewItem = {
  exerciseId: string
  name: string
  emoji: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

type SoloRow = {
  exerciseId: string
  name: string
  emoji: string
  sortOrder: number
}

type StationRow = {
  exerciseId: string
  name: string
  emoji: string
  position: number
}

type BlockRow = {
  sortOrder: number
  stations: StationRow[]
}

type DayRow = {
  sortOrder: number
  solos: SoloRow[]
  blocks: BlockRow[]
}

type OrderedLine = ProgramExercisePreviewItem & {
  dayOrder: number
  slotOrder: number
  innerOrder: number
}

function parseSolo(raw: unknown): SoloRow | null {
  if (!isRecord(raw)) return null
  const name = asString(raw.name_snapshot)
  const sortOrder = asFiniteNumber(raw.sort_order)
  if (name == null || sortOrder == null) return null
  return {
    exerciseId: asString(raw.exercise_id) ?? name,
    name,
    emoji: asString(raw.emoji_snapshot) ?? "",
    sortOrder,
  }
}

function parseStation(raw: unknown): StationRow | null {
  if (!isRecord(raw)) return null
  const name = asString(raw.name_snapshot)
  const position = asFiniteNumber(raw.position)
  if (name == null || position == null) return null
  return {
    exerciseId: asString(raw.exercise_id) ?? name,
    name,
    emoji: asString(raw.emoji_snapshot) ?? "",
    position,
  }
}

function parseBlock(raw: unknown): BlockRow | null {
  if (!isRecord(raw)) return null
  const sortOrder = asFiniteNumber(raw.sort_order)
  if (sortOrder == null) return null
  const stations = Array.isArray(raw.exercises)
    ? raw.exercises
        .map(parseStation)
        .filter((station): station is StationRow => station != null)
    : []
  return { sortOrder, stations }
}

function parseDay(raw: unknown): DayRow | null {
  if (!isRecord(raw)) return null
  const sortOrder = asFiniteNumber(raw.sort_order)
  if (sortOrder == null) return null
  const solos = Array.isArray(raw.workout_exercises)
    ? raw.workout_exercises
        .map(parseSolo)
        .filter((solo): solo is SoloRow => solo != null)
    : []
  const blocks = Array.isArray(raw.exercise_blocks)
    ? raw.exercise_blocks
        .map(parseBlock)
        .filter((block): block is BlockRow => block != null)
    : []
  return { sortOrder, solos, blocks }
}

export function flattenProgramExercisePreview(
  data: unknown,
): ProgramExercisePreviewItem[] {
  const days = Array.isArray(data)
    ? data.map(parseDay).filter((day): day is DayRow => day != null)
    : []

  const lines: OrderedLine[] = days.flatMap((day) => {
    const solos = day.solos.map((solo) => ({
      exerciseId: solo.exerciseId,
      name: solo.name,
      emoji: solo.emoji,
      dayOrder: day.sortOrder,
      slotOrder: solo.sortOrder,
      innerOrder: 0,
    }))
    const stations = day.blocks.flatMap((block) =>
      block.stations.map((station) => ({
        exerciseId: station.exerciseId,
        name: station.name,
        emoji: station.emoji,
        dayOrder: day.sortOrder,
        slotOrder: block.sortOrder,
        innerOrder: station.position,
      })),
    )
    return [...solos, ...stations]
  })

  const sorted = [...lines].sort(
    (a, b) =>
      a.dayOrder - b.dayOrder ||
      a.slotOrder - b.slotOrder ||
      a.innerOrder - b.innerOrder,
  )

  return sorted
    .filter(
      (line, index) =>
        sorted.findIndex((other) => other.exerciseId === line.exerciseId) ===
        index,
    )
    .map(({ exerciseId, name, emoji }) => ({ exerciseId, name, emoji }))
}
