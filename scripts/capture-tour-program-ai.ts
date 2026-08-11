/**
 * HITL: AI program draft via Embedded Agent (Tour 01a).
 *
 * The real agent is chatty when gathering elements — we mock a multi-turn
 * intake then jump to the draft preview (no Gemini).
 *
 *   CAPTURE_APP_ORIGIN=http://localhost:5174 npx tsx scripts/capture-tour-program-ai.ts
 *
 * Writes:
 *   01-agent-intake.png   — chatty gathering (extra draft)
 *   01a-program-draft.png — draft preview ready to accept/reject (Tour 01a)
 */

import "./load-env.js"
import { chromium, type Page, type Route } from "@playwright/test"
import {
  OUT_DIR,
  assertAuthReady,
  assertAuthenticated,
  dismissNoise,
  phoneContextOptions,
  resolveAppOrigin,
  shot,
} from "./capture-tour-shared.js"

type RouteState = { sendCount: number; draftCommitted: boolean }

const DRAFT_PREVIEW = {
  args: {
    name: "Echo Strength Remix — 3×",
    days: [
      { label: "Push", exercises: ["uuid-1", "uuid-2"] },
      { label: "Pull", exercises: ["uuid-3"] },
      { label: "Legs", exercises: ["uuid-4", "uuid-5"] },
    ],
  },
  rendered: [
    { label: "Push", lines: ["Bench Press — 4 × 6 — 150s rest", "OHP — 3 × 8 — 120s rest"] },
    { label: "Pull", lines: ["Wide-grip Lat Pulldown — 4 × 8 — 120s rest", "Dumbbell Row — 3 × 10 — 90s rest"] },
    { label: "Legs", lines: ["Barbell Squat — 4 × 5 — 180s rest", "RDL — 3 × 8 — 150s rest"] },
  ],
}

const CHAT_TURNS: { user: string; assistant: string; ready: boolean }[] = [
  {
    user: "I want a fresh 3-day strength block — intermediate, full gym",
    assistant:
      "Got it — 3×/week strength in a full gym. How many minutes per session, and any joints or movements we should protect?",
    ready: false,
  },
  {
    user: "About 60 minutes. Knees are fine, but go easy on my left shoulder pressing volume.",
    assistant:
      "Noted — ~60 min, shoulder-friendly pressing. Prefer more hypertrophy accessories or keep it compound-heavy?",
    ready: false,
  },
  {
    user: "Compound-heavy. Bench is stalling — I want that as the main push focus.",
    assistant:
      "Perfect. I'll draft a Push / Pull / Legs block with bench as the push priority and moderated OHP volume for the shoulder.",
    ready: true,
  },
]

function makeEmbeddedAgentRoute(state: RouteState) {
  return async (route: Route) => {
    const body = JSON.parse(route.request().postData() ?? "{}") as {
      action?: string
      purpose?: string
    }

    if (body.action === "open" && body.purpose === "additional_program") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          thread_id: "00000000-0000-0000-0000-00000000c466",
          status: state.draftCommitted ? "preview_ready" : "open",
          resumed: false,
          messages: [],
          last_preview: state.draftCommitted ? DRAFT_PREVIEW : null,
          bundle_summary: {
            sessions_per_week: 3,
            active_program_name: "Echo Strength — 3×",
            top_muscle_group: "chest",
          },
        }),
      })
    }

    if (body.action === "send") {
      const turn = CHAT_TURNS[Math.min(state.sendCount, CHAT_TURNS.length - 1)]!
      state.sendCount += 1
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          assistant: {
            content: turn.assistant,
            ts: new Date().toISOString(),
          },
          ready_for_draft: turn.ready,
        }),
      })
    }

    if (body.action === "draft") {
      state.draftCommitted = true
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "preview_ready",
          trigger: "user_cta",
          preview: DRAFT_PREVIEW,
        }),
      })
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    })
  }
}

async function sendChat(page: Page, text: string) {
  const composer = page.getByPlaceholder(/write a message/i)
  await composer.fill(text)
  await page.getByRole("button", { name: /^send$/i }).click()
}

async function main() {
  assertAuthReady()
  const appOrigin = await resolveAppOrigin()
  console.log(`[capture-program-ai] origin=${appOrigin}`)
  console.log(`[capture-program-ai] out=${OUT_DIR}`)

  const state: RouteState = { sendCount: 0, draftCommitted: false }
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext(phoneContextOptions())
  const page = await context.newPage()

  await page.route("**/functions/v1/embedded-agent", makeEmbeddedAgentRoute(state))
  await page.route("**/generativelanguage.googleapis.com/**", (route) => {
    void route.abort()
  })

  await page.goto(new URL("/create-program", appOrigin).toString(), {
    waitUntil: "networkidle",
  })
  await assertAuthenticated(page)
  await dismissNoise(page)

  await page.getByText(/AI Generate/i).first().waitFor({ state: "visible", timeout: 20_000 })
  await page.getByText(/AI Generate/i).first().click()

  await page
    .getByRole("heading", { name: /design your next program/i })
    .waitFor({ state: "visible", timeout: 20_000 })

  // Chatty intake — three turns gathering elements.
  for (const turn of CHAT_TURNS) {
    await sendChat(page, turn.user)
    await page.getByText(turn.assistant.slice(0, 40)).waitFor({
      state: "visible",
      timeout: 15_000,
    })
    await page.waitForTimeout(400)
  }

  console.log("[capture-program-ai] 01-agent-intake (chatty gathering)")
  await shot(page, "01-agent-intake")

  await page.getByRole("button", { name: /generate my plan/i }).click()
  await page
    .getByRole("heading", { name: /your new program draft/i })
    .waitFor({ state: "visible", timeout: 30_000 })
  await page.getByText(/Bench Press/i).first().waitFor({ state: "visible", timeout: 10_000 })
  await page.waitForTimeout(600)

  console.log("[capture-program-ai] 01a-program-draft")
  await shot(page, "01a-program-draft")

  await browser.close()
  console.log(
    "[capture-program-ai] Done. Review:\n" +
      "  01-agent-intake.png    — chatty element gathering\n" +
      "  01a-program-draft.png — draft preview (Tour 01a)\n" +
      "Say the word to swap 01a (and optionally use intake elsewhere).",
  )
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
