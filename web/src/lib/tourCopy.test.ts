import { describe, expect, it } from 'vitest'
import { tourDoors, tourHero, tourNavLabel } from './tourCopy'

describe('Product Tour copy', () => {
  it('exposes banked hero copy for the Tour route', () => {
    expect(tourHero.h1).toBe('What GymLogic actually does')
    expect(tourHero.sub).toBe(
      "Programs, sessions, progression, catalog, history, your own agent — a lot. Open source, built in public, free. It still won't lift the bar for you.",
    )
  })

  it('exposes dual doors with banked labels and destinations', () => {
    expect(tourDoors.primary).toEqual({
      label: 'Open the app',
      href: 'https://gymlogic.me',
      external: true,
    })
    expect(tourDoors.secondary).toEqual({
      label: 'Connect your agent',
      href: '/connect/claude',
      external: false,
    })
  })

  it('exposes the nav label Tour', () => {
    expect(tourNavLabel).toBe('Tour')
  })
})
