import type { MuscleTaxonomy } from "@/lib/trainingBalance"
import type {
  MixSeries,
  MuscleRadarValues,
  RecordsComboSeries,
} from "./profileChartData"

export const MIX_7_CATEGORIES = [
  "Lun",
  "Mar",
  "Mer",
  "Jeu",
  "Ven",
  "Sam",
  "Dim",
] as const

export const MIX_7_SERIES: MixSeries = {
  programme: [1, 0, 0, 0, 0, 0, 0],
  quickWorkout: [0, 0, 1, 0, 0, 0, 0],
  circuits: [0, 0, 0, 0, 1, 0, 0],
}

export const COMBO_CATEGORIES = ["Lun", "Mer", "Ven"] as const

export const COMBO_SERIES: RecordsComboSeries = {
  prs: [0, 0, 1],
  rir0: [8, null, 22],
}

export const RADAR_CURRENT = {
  Pectoraux: 0.9,
  Dos: 0.85,
  Épaules: 0.5,
  Biceps: 0.4,
  Triceps: 0.45,
  Quadriceps: 0.8,
  Ischios: 0.55,
  Fessiers: 0.5,
  Adducteurs: 0.25,
  Mollets: 0.3,
  Abdos: 0.45,
  Trapèzes: 0.35,
  Lombaires: 0.3,
} satisfies Record<MuscleTaxonomy, number>

export const RADAR_PRIOR = {
  Pectoraux: 0.8,
  Dos: 0.7,
  Épaules: 0.45,
  Biceps: 0.35,
  Triceps: 0.5,
  Quadriceps: 0.9,
  Ischios: 0.4,
  Fessiers: 0.4,
  Adducteurs: 0.2,
  Mollets: 0.25,
  Abdos: 0.55,
  Trapèzes: 0.3,
  Lombaires: 0.25,
} satisfies Record<MuscleTaxonomy, number>

export const RADAR_SERIES = {
  current: RADAR_CURRENT,
  prior: RADAR_PRIOR,
} satisfies { current: MuscleRadarValues; prior: MuscleRadarValues }
