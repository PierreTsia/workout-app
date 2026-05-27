export type BeepFireSpec = {
  atMsFromStart: number
  kind: "warning" | "finish"
}

const WARNING_OFFSETS_SECONDS = [3, 2, 1] as const

export function buildBeepSchedule(targetSeconds: number): BeepFireSpec[] {
  const candidates: BeepFireSpec[] = [
    ...WARNING_OFFSETS_SECONDS.map((secondsBeforeEnd) => ({
      atMsFromStart: (targetSeconds - secondsBeforeEnd) * 1000,
      kind: "warning" as const,
    })),
    { atMsFromStart: targetSeconds * 1000, kind: "finish" as const },
  ]

  return candidates.filter((spec) => spec.atMsFromStart > 0)
}
