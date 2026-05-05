// @ts-check
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'

// https://astro.build/config
// Note: Tailwind v4 is wired via PostCSS (postcss.config.mjs) rather than
// the @tailwindcss/vite plugin, which currently has a compat issue with
// Astro 6's rolldown-vite (withastro/astro#16542).
export default defineConfig({
  output: 'static',
  site: 'https://docs.gymlogic.me',
  integrations: [
    react(),
    mdx(),
    sitemap(),
  ],
  markdown: {
    shikiConfig: {
      theme: 'material-theme-darker',
    },
  },
  redirects: {
    '/claude-connector': {
      destination: '/connect/claude',
      status: 308,
    },
  },
  vite: {
    // Astro 6 + React 19 dev mode otherwise throws
    // `jsxDEV is not a function` on hydration of any React island.
    // See withastro/astro#13189 — pre-bundling the JSX runtimes pins
    // both SSR and client to the same module instance.
    optimizeDeps: {
      include: ['react/jsx-runtime', 'react/jsx-dev-runtime'],
    },
  },
})
