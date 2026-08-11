import { describe, expect, it } from 'vitest'
import { shouldPinTourTheater, tourStageImageStyle } from './tourMotion'

describe('Tour motion helpers', () => {
  it('disables pin theater when the user prefers reduced motion', () => {
    expect(shouldPinTourTheater(true)).toBe(false)
    expect(shouldPinTourTheater(false)).toBe(true)
  })

  it('applies focal origin and Ken Burns only when motion is allowed and the scene is active', () => {
    expect(tourStageImageStyle({ focal: '70% 40%', active: true, reducedMotion: false })).toEqual({
      transformOrigin: '70% 40%',
      animationName: 'tour-ken-burns',
    })
    expect(tourStageImageStyle({ focal: '70% 40%', active: false, reducedMotion: false })).toEqual({
      transformOrigin: '70% 40%',
      animationName: 'none',
    })
    expect(tourStageImageStyle({ focal: '70% 40%', active: true, reducedMotion: true })).toEqual({
      transformOrigin: '70% 40%',
      animationName: 'none',
    })
  })
})
