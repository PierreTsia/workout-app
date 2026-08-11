import { describe, expect, it } from 'vitest'

import {
  tourEase,
  tourProgressFade,
  tourRailExpand,
  tourShotFade,
  tourStageFade,
} from './tourTransitions'

describe('tourTransitions', () => {
  it('uses a soft ease-out curve (not linear)', () => {
    expect(tourEase[0]).toBeLessThan(0.5)
    expect(tourEase[1]).toBe(1)
    expect(tourEase[3]).toBe(1)
  })

  it('keeps stage fade longer than shot fade for chapter changes', () => {
    expect(tourStageFade.duration).toBeGreaterThan(tourShotFade.duration)
    expect(tourStageFade.duration).toBeGreaterThanOrEqual(0.5)
  })

  it('staggers rail copy opacity after height starts opening', () => {
    expect(tourRailExpand.opacity.delay).toBeGreaterThan(0)
    expect(tourRailExpand.height.duration).toBeGreaterThan(
      tourRailExpand.opacity.duration * 0.5,
    )
  })

  it('keeps progress tick snappy relative to stage', () => {
    expect(tourProgressFade.duration).toBeLessThan(tourStageFade.duration)
  })
})
