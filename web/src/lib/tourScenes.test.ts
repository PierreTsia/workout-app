import { describe, expect, it } from 'vitest'
import { tourScenes } from './tourScenes'

describe('Product Tour scene catalog', () => {
  it('exports seven scenes numbered 1–7', () => {
    expect(tourScenes).toHaveLength(7)
    expect(tourScenes.map((s) => s.id)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('uses banked titles and ledes exactly', () => {
    expect(tourScenes.map((s) => s.title)).toEqual([
      'Get a program',
      'Train the session',
      'Progress on purpose',
      'One-off days',
      'Bring your agent',
      'Know the movement',
      'See yourself over time',
    ])
    expect(tourScenes.map((s) => s.lede)).toEqual([
      'Three ways in; the money shot is the draft you accept or reject.',
      'Log the work without a spreadsheet brain.',
      'Next load from last session + RIR — add weight, add reps, hold, or plateau.',
      'Off-program day — constraints in, one session out, you decide before you lift.',
      'Bring your own agent; the app is the body — data, catalog, persistence.',
      '360+ curated exercises — precise explainers and demos.',
      'Consistency and diagnosis — not an analytics dashboard page.',
    ])
  })

  it('marks Bring your agent as desktop chrome; others phone', () => {
    expect(tourScenes.find((s) => s.id === 5)?.device).toBe('desktop')
    expect(
      tourScenes.filter((s) => s.id !== 5).every((s) => s.device === 'phone'),
    ).toBe(true)
  })

  it('lists last-performance facts on Train the session only', () => {
    const train = tourScenes.find((s) => s.id === 2)
    expect(train?.facts).toEqual([
      'Last performance on the set',
      'Rest timer',
      'RIR',
    ])
  })

  it('references seven distinct image sources', () => {
    const srcs = tourScenes.map((s) => s.image.src)
    expect(new Set(srcs).size).toBe(7)
  })
})
