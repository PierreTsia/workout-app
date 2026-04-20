import path from "path"
import { defineConfig, loadEnv, type PluginOption } from "vite"
import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa"
import { sentryVitePlugin } from "@sentry/vite-plugin"
import { visualizer } from "rollup-plugin-visualizer"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const sentryAuthToken =
    env.SENTRY_AUTH_TOKEN ?? process.env.SENTRY_AUTH_TOKEN
  const sentryOrg = env.SENTRY_ORG ?? process.env.SENTRY_ORG
  const sentryProject = env.SENTRY_PROJECT ?? process.env.SENTRY_PROJECT
  const analyze = process.env.ANALYZE === "true"

  const plugins: PluginOption[] = [
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
        // Default 2 MiB fails when the main chunk exceeds the limit (e.g. PostHog + app code).
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
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

  if (analyze) {
    plugins.push(
      visualizer({
        filename: "dist/stats.html",
        gzipSize: true,
        brotliSize: true,
        open: true,
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
      rollupOptions: {
        output: {
          // Split heavy third-party libs into stable vendor chunks so they
          // cache independently of app code and don't duplicate across the
          // lazy route chunks introduced in T67. Anything not matched falls
          // through to Rollup's default splitting (shared async deps get
          // their own chunk, the rest stays in the entry).
          manualChunks(id) {
            if (!id.includes("node_modules")) return
            if (id.includes("recharts") || id.includes("/d3-"))
              return "chart-vendor"
            if (id.includes("cmdk") || id.includes("vaul"))
              return "picker-vendor"
            if (
              id.includes("@tanstack/react-table") ||
              id.includes("@tanstack/table-core")
            )
              return "table-vendor"
            if (id.includes("@radix-ui")) return "radix-vendor"
            if (id.includes("@supabase")) return "supabase-vendor"
            if (id.includes("@sentry")) return "sentry-vendor"
            if (id.includes("posthog")) return "posthog-vendor"
            if (id.includes("embla-carousel")) return "embla-vendor"
            if (id.includes("@dnd-kit")) return "dnd-vendor"
            if (id.includes("react-day-picker") || id.includes("date-fns"))
              return "calendar-vendor"
          },
        },
      },
    },
  }
})
