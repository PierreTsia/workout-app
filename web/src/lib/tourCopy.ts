/** Banked Product Tour (#466) marketing copy — single source for hero, doors, nav. */

export const tourNavLabel = 'Tour' as const

export const tourHero = {
  h1: 'What GymLogic actually does',
  sub: "Programs, sessions, progression, catalog, history, your own agent — a lot. Open source, built in public, free. It still won't lift the bar for you.",
} as const

export const tourDoors = {
  primary: {
    label: 'Open the app',
    href: 'https://gymlogic.me',
    external: true,
  },
  secondary: {
    label: 'Connect your agent',
    href: '/connect/claude',
    external: false,
  },
} as const
