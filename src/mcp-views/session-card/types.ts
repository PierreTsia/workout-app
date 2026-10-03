export type SoloSet = {
  measure: string
  weightKg: number
  isPr: boolean
}

export type SoloItem = {
  kind: 'solo'
  name: string
  sets: SoloSet[]
}

export type CircuitItem = {
  kind: 'circuit'
  label: string
  mode: 'amrap' | 'rounds'
  rounds: number
  amrap?: { fullRounds: number; leftover: number; leftoverName: string }
  completionSeconds?: number
}

export type SessionCardItem = SoloItem | CircuitItem

export type SessionCardSession = {
  id: string
  label: string
  finishedAtLabel: string
  durationLabel: string
  setsDone: number
}

export type SessionCardPayload = {
  locale: 'en' | 'fr'
  session: SessionCardSession | null
  tonnageKg: number
  items: SessionCardItem[]
}

export type SessionCardLabels = {
  title: string
  tonnage: string
  sets: string
  pr: string
  circuit: string
  time: string
  rounds: string
  amrapGloss: string
  empty: string
  emptyHint: string
}
