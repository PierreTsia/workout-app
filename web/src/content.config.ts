import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const connect = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/connect' }),
  schema: z.object({
    slug: z.string(),
    clientName: z.string(),
    clientUrl: z.string().url(),

    title: z.string(),
    description: z.string(),
    ogImage: z.string(),

    hero: z.object({
      eyebrow: z.string().optional(),
      h1: z.string(),
      subheadlines: z.array(z.string()).max(4),
      heroImage: z
        .object({
          src: z.string(),
          alt: z.string(),
        })
        .optional(),
      ctaLabel: z.string().optional(),
      ctaAnchor: z.string().optional(),
    }),

    pageOrder: z.number().default(99),

    available: z.object({
      oauth: z.boolean().default(true),
      pat: z.boolean().default(false),
      mcpRemote: z.boolean().default(false),
    }),
  }),
})

export const collections = { connect }
