import type { ImageMetadata } from 'astro'

import s01a from '../assets/screenshots/tour/01a-program-draft.jpg'
import s01b from '../assets/screenshots/tour/01b-program-accept.jpg'
import s01c from '../assets/screenshots/tour/01c-program-agent.jpg'
import s02a from '../assets/screenshots/tour/02a-train-sets.png'
import s02b from '../assets/screenshots/tour/02b-train-rir.jpg'
import s02c from '../assets/screenshots/tour/02c-train-last.jpg'
import s03a from '../assets/screenshots/tour/03a-progress-suggest.jpg'
import s03b from '../assets/screenshots/tour/03b-progress-hold.jpg'
import s03c from '../assets/screenshots/tour/03c-progress-plateau.jpg'
import s05a from '../assets/screenshots/tour/05a-agent-chat.png'
import s05b from '../assets/screenshots/tour/05b-agent-tools.png'
import s05c from '../assets/screenshots/tour/05c-agent-result.png'
import s06a from '../assets/screenshots/tour/06a-movement-list.jpg'
import s06b from '../assets/screenshots/tour/06b-movement-detail.jpg'
import s06c from '../assets/screenshots/tour/06c-movement-video.jpg'
import s07a from '../assets/screenshots/tour/07a-history-heatmap.jpg'
import s07b from '../assets/screenshots/tour/07b-history-balance.jpg'
import s07c from '../assets/screenshots/tour/07c-history-achievements.jpg'

export type TourSceneDevice = 'phone' | 'desktop'

export type TourShot = {
  image: ImageMetadata
  alt: string
  focal: string
}

export type TourScene = {
  id: 1 | 2 | 3 | 4 | 5 | 6
  slug: string
  title: string
  lede: string
  facts: string[]
  device: TourSceneDevice
  shots: TourShot[]
}

export const tourScenes: TourScene[] = [
  {
    id: 1,
    slug: 'start-with-a-program',
    title: 'Start with a program',
    lede:
      'AI draft, build it yourself, or a Quick Workout — onboarding that gets you lifting the same day.',
    facts: [
      'AI program generation',
      'Blank / template you own',
      'Quick Workout for one session',
    ],
    device: 'phone',
    shots: [
      {
        image: s01a,
        alt: 'AI program draft preview ready to accept or reject.',
        focal: '50% 20%',
      },
      {
        image: s01b,
        alt: 'Building or adjusting a program yourself.',
        focal: '50% 30%',
      },
      {
        image: s01c,
        alt: 'Quick Workout one-off session from constraints.',
        focal: '50% 40%',
      },
    ],
  },
  {
    id: 2,
    slug: 'train-the-session',
    title: 'Train the session',
    lede: 'Log the work without a spreadsheet brain.',
    facts: ['Last performance on the set', 'Rest timer', 'RIR'],
    device: 'phone',
    shots: [
      {
        image: s02a,
        alt: 'In-session sets table mid-workout.',
        focal: '50% 35%',
      },
      {
        image: s02b,
        alt: 'Logging RIR on a working set.',
        focal: '70% 40%',
      },
      {
        image: s02c,
        alt: 'Last performance shown on the current set.',
        focal: '50% 45%',
      },
    ],
  },
  {
    id: 3,
    slug: 'progress-on-purpose',
    title: 'Progress on purpose',
    lede: 'Suggestions from last session and RIR — you confirm the call.',
    facts: ['Add weight', 'Add reps', 'Hold', 'Plateau'],
    device: 'phone',
    shots: [
      {
        image: s03a,
        alt: 'Progression suggestion to add weight.',
        focal: '70% 40%',
      },
      {
        image: s03b,
        alt: 'Hold suggestion when the target is met.',
        focal: '50% 35%',
      },
      {
        image: s03c,
        alt: 'Plateau flag when progress stalls.',
        focal: '50% 30%',
      },
    ],
  },
  {
    id: 4,
    slug: 'bring-your-own-agent',
    title: 'Bring your own agent! 🤖',
    lede:
      'Your agent reads your training data and can evaluate, create, and update programs — the app stays the system of record.',
    facts: [
      'Read history & catalog',
      'Create and update programs',
      'Claude, other MCP clients, or CLI',
    ],
    device: 'desktop',
    shots: [
      {
        image: s05a,
        alt: 'Desktop agent conversation creating a program via MCP.',
        focal: '50% 50%',
      },
      {
        image: s05b,
        alt: 'Agent calling GymLogic tools over MCP.',
        focal: '50% 45%',
      },
      {
        image: s05c,
        alt: 'Program landed in the app from the agent.',
        focal: '50% 40%',
      },
    ],
  },
  {
    id: 5,
    slug: 'know-the-movement',
    title: 'Know the movement',
    lede:
      'A curated, searchable catalog — every movement explained in EN and FR, with a demo when you need the visual.',
    facts: [
      'Searchable bilingual catalog',
      'Detailed instructions (EN / FR)',
      'Related demo video',
    ],
    device: 'phone',
    shots: [
      {
        image: s06a,
        alt: 'Exercise library list with filters.',
        focal: '50% 20%',
      },
      {
        image: s06b,
        alt: 'Exercise detail with bilingual instructions and body map.',
        focal: '50% 30%',
      },
      {
        image: s06c,
        alt: 'Exercise demo video on the detail screen.',
        focal: '50% 35%',
      },
    ],
  },
  {
    id: 6,
    slug: 'see-yourself-over-time',
    title: 'See yourself over time',
    lede:
      'Your full training story in one place — history, progress, and the wins along the way.',
    facts: [
      'Session history & heatmap',
      'Progression over time',
      'Achievements & milestones',
    ],
    device: 'phone',
    shots: [
      {
        image: s07a,
        alt: 'Training history heatmap across recent days.',
        focal: '50% 40%',
      },
      {
        image: s07b,
        alt: 'Strength Balance and progression over time.',
        focal: '50% 30%',
      },
      {
        image: s07c,
        alt: 'Achievements and milestones unlocked.',
        focal: '50% 25%',
      },
    ],
  },
]
