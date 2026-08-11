/** Shared Motion timing for Product Tour — soft, editorial, no layout shove. */

export const tourEase = [0.16, 1, 0.3, 1] as const

export const tourStageFade = {
  duration: 0.55,
  ease: tourEase,
}

export const tourShotFade = {
  duration: 0.45,
  ease: tourEase,
}

export const tourRailExpand = {
  height: { duration: 0.42, ease: tourEase },
  opacity: { duration: 0.32, ease: tourEase, delay: 0.06 },
}

export const tourProgressFade = {
  duration: 0.28,
  ease: tourEase,
}
