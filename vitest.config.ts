import path from "path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // web/ and infra/ have their own Vitest configs (Astro / Worker).
    // Pulling them into the SPA suite breaks on Astro's tsconfig extend.
    exclude: ["e2e/**", "web/**", "infra/**", "**/node_modules/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
