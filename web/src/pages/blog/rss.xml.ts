import rss from '@astrojs/rss'
import type { APIContext } from 'astro'

export async function GET(context: APIContext) {
  return rss({
    title: 'GymLogic Blog',
    description:
      'Engineering write-ups, postmortems, and process notes from building GymLogic.',
    site: context.site!,
    items: [],
    customData: '<language>en-us</language>',
  })
}
