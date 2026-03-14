import { defineConfig, devices } from "@playwright/test"

const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321"
const LOCAL_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",

  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },

  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
        permissions: ["notifications"],
      },
      testIgnore: "login.spec.ts",
    },
    {
      name: "unauthenticated",
      use: {
        ...devices["Desktop Chrome"],
      },
      testMatch: "login.spec.ts",
    },
  ],

  webServer: {
    command: "npm run build && npx vite preview --port 5173",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_SUPABASE_URL: LOCAL_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: LOCAL_SUPABASE_ANON_KEY,
    },
  },
})
