// @ts-check
import { defineConfig } from 'astro/config'

// https://astro.build/config
// Note: Tailwind v4 is wired via PostCSS (postcss.config.mjs) rather than
// the @tailwindcss/vite plugin, which currently has a compat issue with
// Astro 6's rolldown-vite (withastro/astro#16542).
export default defineConfig({
  output: 'static',
  site: 'https://docs.gymlogic.me',
})
