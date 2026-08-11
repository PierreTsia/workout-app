import { describe, expect, it } from 'vitest'
import {
  beatScrollOffset,
  formatTourProgress,
  pickActiveBeatIndex,
} from './tourScroll'

describe('Tour scroll helpers', () => {
  it('formats progress as NN / 07 from a zero-based index', () => {
    expect(formatTourProgress(0, 7)).toBe('01 / 07')
    expect(formatTourProgress(6, 7)).toBe('07 / 07')
  })

  it('picks the intersecting beat with the highest ratio', () => {
    expect(
      pickActiveBeatIndex([
        { index: 1, intersectionRatio: 0.2 },
        { index: 2, intersectionRatio: 0.8 },
        { index: 3, intersectionRatio: 0.1 },
      ]),
    ).toBe(2)
  })

  it('returns null when nothing intersects', () => {
    expect(pickActiveBeatIndex([])).toBeNull()
    expect(
      pickActiveBeatIndex([{ index: 0, intersectionRatio: 0 }]),
    ).toBeNull()
  })

  it('maps a rail click index to a scroll offset inside the pin', () => {
    // pin height 700 for 7 scenes → 100px per beat; index 3 → 300
    expect(beatScrollOffset({ pinHeight: 700, sceneCount: 7, index: 3 })).toBe(
      300,
    )
  })
})
