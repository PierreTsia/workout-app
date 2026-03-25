import path from "path"
import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa"
import { sentryVitePlugin } from "@sentry/vite-plugin"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const sentryAuthToken =
    env.SENTRY_AUTH_TOKEN ?? process.env.SENTRY_AUTH_TOKEN
  const sentryOrg = env.SENTRY_ORG ?? process.env.SENTRY_ORG
  const sentryProject = env.SENTRY_PROJECT ?? process.env.SENTRY_PROJECT

  const plugins = [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: ["pwa-192x192.svg", "og-image.png"],
      manifest: {
        name: "GymLogic",
        short_name: "GymLogic",
        description:
          "Strength training on your phone — log sessions, track PRs, offline sync.",
        theme_color: "#0f0f13",
        background_color: "#0f0f13",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/pwa-192x192.svg",
            sizes: "any",
            type: "image/svg+xml",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api",
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 },
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
    }),
  ]

  if (sentryAuthToken && sentryOrg && sentryProject) {
    plugins.push(
      sentryVitePlugin({
        org: sentryOrg,
        project: sentryProject,
        authToken: sentryAuthToken,
        sourcemaps: {
          filesToDeleteAfterUpload: ["./dist/**/*.map"],
        },
      }),
    )
  }

  return {
    define: {
      __APP_VERSION__: JSON.stringify(
        mode === "production" ? Date.now().toString(36) : "dev",
      ),
    },

    plugins,

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },

    build: {
      sourcemap: true,
    },
  }
})
