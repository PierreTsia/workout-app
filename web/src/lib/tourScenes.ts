import type { ImageMetadata } from 'astro'

import img01 from '../assets/screenshots/tour/01-get-a-program.jpg'
import img02 from '../assets/screenshots/tour/02-train-the-session.png'
import img03 from '../assets/screenshots/tour/03-progress-on-purpose.jpg'
import img04 from '../assets/screenshots/tour/04-one-off-days.png'
import img05 from '../assets/screenshots/tour/05-bring-your-agent.png'
import img06 from '../assets/screenshots/tour/06-know-the-movement.jpg'
import img07 from '../assets/screenshots/tour/07-see-yourself-over-time.jpg'

export type TourSceneDevice = 'phone' | 'desktop'

export type TourScene = {
  id: 1 | 2 | 3 | 4 | 5 | 6 | 7
  slug: string
  title: string
  lede: string
  facts: string[]
  device: TourSceneDevice
  image: ImageMetadata
  alt: string
  focal: string
}

export const tourScenes: TourScene[] = [
  {
    id: 1,
    slug: 'get-a-program',
    title: 'Get a program',
    lede: 'Three ways in; the money shot is the draft you accept or reject.',
    facts: [],
    device: 'phone',
    image: img01,
    alt: 'Program draft preview ready to accept or reject.',
    focal: '50% 20%',
  },
  {
    id: 2,
    slug: 'train-the-session',
    title: 'Train the session',
    lede: 'Log the work without a spreadsheet brain.',
    facts: ['Last performance on the set', 'Rest timer', 'RIR'],
    device: 'phone',
    image: img02,
    alt: 'In-session sets table with last performance and RIR.',
    focal: '50% 35%',
  },
  {
    id: 3,
    slug: 'progress-on-purpose',
    title: 'Progress on purpose',
    lede:
      'Next load from last session + RIR — add weight, add reps, hold, or plateau.',
    facts: [],
    device: 'phone',
    image: img03,
    alt: 'Progression suggestion over the current set.',
    focal: '70% 40%',
  },
  {
    id: 4,
    slug: 'one-off-days',
    title: 'One-off days',
    lede:
      'Off-program day — constraints in, one session out, you decide before you lift.',
    facts: [],
    device: 'phone',
    image: img04,
    alt: 'Quick Workout preview with coach rationale.',
    focal: '50% 25%',
  },
  {
    id: 5,
    slug: 'bring-your-agent',
    title: 'Bring your agent',
    lede:
      'Bring your own agent; the app is the body — data, catalog, persistence.',
    facts: [],
    device: 'desktop',
    image: img05,
    alt: 'Desktop agent conversation creating a program via MCP.',
    focal: '50% 50%',
  },
  {
    id: 6,
    slug: 'know-the-movement',
    title: 'Know the movement',
    lede: '360+ curated exercises — precise explainers and demos.',
    facts: [],
    device: 'phone',
    image: img06,
    alt: 'Exercise detail with instructions, video, and body map.',
    focal: '50% 30%',
  },
  {
    id: 7,
    slug: 'see-yourself-over-time',
    title: 'See yourself over time',
    lede: 'Consistency and diagnosis — not an analytics dashboard page.',
    facts: [],
    device: 'phone',
    image: img07,
    alt: 'Training history heatmap across recent days.',
    focal: '50% 40%',
  },
]
