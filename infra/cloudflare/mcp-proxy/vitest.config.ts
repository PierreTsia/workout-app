import { defineConfig } from "vitest/config"

// Local config so vitest doesn't walk up to the repo root and pick up
// jsdom + SPA-specific setup files. Worker tests run in plain Node.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
})
