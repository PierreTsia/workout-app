import { getCollection, type CollectionEntry } from 'astro:content'
import readingTimeFn from 'reading-time'

export type BlogEntry = CollectionEntry<'blog'>

/**
 * Returns blog posts ready for rendering. Drafts are included in dev
 * (`import.meta.env.DEV`) and excluded from any build (preview, prod).
 * Sorted by date desc with filename tiebreaker for determinism.
 */
export async function getPublishedPosts(): Promise<BlogEntry[]> {
  const includeDrafts = import.meta.env.DEV
  const all = await getCollection('blog')
  return all
    .filter((p) => includeDrafts || !p.data.draft)
    .sort((a, b) => {
      const dt = b.data.date.getTime() - a.data.date.getTime()
      return dt !== 0 ? dt : a.id.localeCompare(b.id)
    })
}

/**
 * Older / newer navigation for a post within the published list.
 * Index 0 is newest; "older" sits at higher indices, "newer" at lower.
 */
export function getPrevNext(
  slug: string,
  posts: BlogEntry[],
): { older: BlogEntry | undefined; newer: BlogEntry | undefined } {
  const i = posts.findIndex((p) => p.id === slug)
  if (i === -1) return { older: undefined, newer: undefined }
  return {
    newer: i > 0 ? posts[i - 1] : undefined,
    older: i < posts.length - 1 ? posts[i + 1] : undefined,
  }
}

/** Whole-minute reading time, floor 1 minute, via the `reading-time` package. */
export function readingTime(body: string): number {
  return Math.max(1, Math.ceil(readingTimeFn(body).minutes))
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

/** "12 May 2026" — en-GB long format, stable across locales. */
export function formatDate(date: Date): string {
  return dateFormatter.format(date)
}
