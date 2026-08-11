export function shouldPinTourTheater(prefersReducedMotion: boolean): boolean {
  return !prefersReducedMotion
}

export function tourStageImageStyle(args: {
  focal: string
  active: boolean
  reducedMotion: boolean
}): { transformOrigin: string; animationName: 'tour-ken-burns' | 'none' } {
  const { focal, active, reducedMotion } = args
  return {
    transformOrigin: focal,
    animationName:
      active && !reducedMotion ? 'tour-ken-burns' : 'none',
  }
}
