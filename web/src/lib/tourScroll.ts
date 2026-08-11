export function formatTourProgress(
  activeIndex: number,
  sceneCount: number,
): string {
  const current = String(activeIndex + 1).padStart(2, '0')
  const total = String(sceneCount).padStart(2, '0')
  return `${current} / ${total}`
}

export function pickActiveBeatIndex(
  intersecting: ReadonlyArray<{ index: number; intersectionRatio: number }>,
): number | null {
  const visible = intersecting.filter((e) => e.intersectionRatio > 0)
  if (visible.length === 0) return null

  return visible.reduce((best, entry) =>
    entry.intersectionRatio > best.intersectionRatio ? entry : best,
  ).index
}

export function beatScrollOffset(args: {
  pinHeight: number
  sceneCount: number
  index: number
}): number {
  const { pinHeight, sceneCount, index } = args
  if (sceneCount <= 0) return 0
  return (pinHeight / sceneCount) * index
}

/** Wheel over the stage: step scenes without a tall page pin. */
export function sceneIndexAfterWheel(args: {
  activeIndex: number
  sceneCount: number
  deltaY: number
}): { index: number; consume: boolean } {
  const { activeIndex, sceneCount, deltaY } = args
  if (deltaY > 0 && activeIndex < sceneCount - 1) {
    return { index: activeIndex + 1, consume: true }
  }
  if (deltaY < 0 && activeIndex > 0) {
    return { index: activeIndex - 1, consume: true }
  }
  return { index: activeIndex, consume: false }
}
