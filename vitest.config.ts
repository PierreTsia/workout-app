import path from "path"
import { defineConfig } from "vitest/config"

/** Same demo values as local Supabase / Playwright — only so `createClient` can load in unit tests. */
const VITE_SUPABASE_URL = "http://127.0.0.1:54321"
const VITE_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    exclude: ["e2e/**", "node_modules/**"],
    env: {
      VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
