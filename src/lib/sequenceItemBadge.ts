export type SequenceItemBadgeKind = "empty" | "solos" | "circuits" | "mixed"

export interface SequenceItemBadge {
  kind: SequenceItemBadgeKind
  solos: number
  circuits: number
}

export function sequenceItemBadge(
  soloCount: number,
  blockCount: number,
): SequenceItemBadge {
  const kind: SequenceItemBadgeKind =
    soloCount === 0 && blockCount === 0
      ? "empty"
      : soloCount > 0 && blockCount > 0
        ? "mixed"
        : blockCount > 0
          ? "circuits"
          : "solos"

  return { kind, solos: soloCount, circuits: blockCount }
}
