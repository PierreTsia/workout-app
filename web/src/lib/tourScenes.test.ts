import { describe, expect, it } from 'vitest'
import { tourScenes } from './tourScenes'

describe('Product Tour scene catalog', () => {
  it('exports six scenes numbered 1–6', () => {
    expect(tourScenes).toHaveLength(6)
    expect(tourScenes.map((s) => s.id)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('uses banked titles and ledes exactly', () => {
    expect(tourScenes.map((s) => s.title)).toEqual([
      'Start with a program',
      'Train the session',
      'Progress on purpose',
      'Bring your own agent! 🤖',
      'Know the movement',
      'See yourself over time',
    ])
    expect(tourScenes.map((s) => s.lede)).toEqual([
      'AI draft, build it yourself, or a Quick Workout — onboarding that gets you lifting the same day.',
      'Log the work without a spreadsheet brain.',
      'Suggestions from last session and RIR — you confirm the call.',
      'Your agent reads your training data and can evaluate, create, and update programs — the app stays the system of record.',
      'A curated, searchable catalog — every movement explained in EN and FR, with a demo when you need the visual.',
      'Your full training story in one place — history, progress, and the wins along the way.',
    ])
  })

  it('sells fast onboarding paths on Start with a program', () => {
    const start = tourScenes.find((s) => s.id === 1)
    expect(start?.facts).toEqual([
      'AI program generation',
      'Blank / template you own',
      'Quick Workout for one session',
    ])
  })

  it('marks Bring your own agent as desktop chrome; others phone', () => {
    expect(tourScenes.find((s) => s.id === 4)?.device).toBe('desktop')
    expect(
      tourScenes.filter((s) => s.id !== 4).every((s) => s.device === 'phone'),
    ).toBe(true)
  })

  it('lists last-performance facts on Train the session', () => {
    const train = tourScenes.find((s) => s.id === 2)
    expect(train?.facts).toEqual([
      'Last performance on the set',
      'RIR',
      'Rest timer',
    ])
  })

  it('lists progression outcomes on Progress on purpose', () => {
    const progress = tourScenes.find((s) => s.id === 3)
    expect(progress?.facts).toEqual([
      'Add weight',
      'Add reps',
      'Hold',
      'Plateau',
    ])
  })

  it('sells agent capability then connect paths on Bring your own agent', () => {
    const agent = tourScenes.find((s) => s.id === 4)
    expect(agent?.facts).toEqual([
      'Read history & catalog',
      'Create and update programs',
      'Claude, other MCP clients, or CLI',
    ])
  })

  it('sells bilingual catalog explainers on Know the movement', () => {
    const movement = tourScenes.find((s) => s.id === 5)
    expect(movement?.facts).toEqual([
      'Searchable bilingual catalog',
      'Detailed instructions (EN / FR)',
      'Related demo video',
    ])
  })

  it('sells history, progression, and successes on See yourself over time', () => {
    const history = tourScenes.find((s) => s.id === 6)
    expect(history?.facts).toEqual([
      'Session history & heatmap',
      'Progression over time',
      'Achievements & milestones',
    ])
  })

  it('gives each scene 2–3 shots with distinct image sources per scene', () => {
    for (const scene of tourScenes) {
      expect(scene.shots.length).toBeGreaterThanOrEqual(2)
      expect(scene.shots.length).toBeLessThanOrEqual(3)
      const srcs = scene.shots.map((shot) => shot.image.src)
      expect(new Set(srcs).size).toBe(scene.shots.length)
    }
  })
})
