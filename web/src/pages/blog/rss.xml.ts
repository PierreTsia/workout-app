import rss from '@astrojs/rss'
import type { APIContext } from 'astro'
import { getPublishedPosts } from '@/lib/blog'

export async function GET(context: APIContext) {
  const posts = await getPublishedPosts()

  return rss({
    title: 'GymLogic Blog',
    description:
      'Engineering write-ups, postmortems, and process notes from building GymLogic.',
    site: context.site!,
    items: posts.map((post) => ({
      title: post.data.title,
      link: `/blog/${post.id}/`,
      pubDate: post.data.date,
      description: post.data.excerpt,
      categories: post.data.tags,
    })),
    customData: '<language>en-us</language>',
  })
}
