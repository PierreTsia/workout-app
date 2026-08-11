/**
 * Shared helpers for Prime Mover Tour capture scripts.
 */

import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  devices,
  type BrowserContextOptions,
} from "@playwright/test"
import sharp from "sharp"
import {
  authStorageKey,
  resolveHostedViteEnv,
} from "./resolve-hosted-vite-env.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(__dirname, "..")
export const AUTH_STATE = path.join(ROOT, "playwright", ".auth", "prime-mover.json")
export const OUT_DIR = path.join(ROOT, "playwright", ".auth", "tour-captures")

/**
 * Reliable phone capture profile for Tour assets.
 *
 * Why not stock `devices['iPhone 14']`?
 * - In this Playwright version that descriptor is **390×664** — shorter than a
 *   real iPhone 14 (390×844) and shorter than the Tour `DeviceFrame`
 *   (`aspect-[9/19.5]` ≈ 390×845).
 *
 * Pipeline for clean Tour phones:
 * 1. Capture at **390×844** @ 3× (this profile).
 * 2. Prefer dense UI in the shot (collapse sparse panels / scroll lists in).
 * 3. `shot()` runs `trimTrailingEmptyChrome` for leftover bottom chrome.
 * 4. `DeviceFrame` displays with `object-cover` + scene focal — never
 *    `object-contain` in the lightbox (that letterboxed empty app chrome).
 */
export const CAPTURE_PHONE = {
  ...devices["iPhone 14"],
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  colorScheme: "dark",
} as const satisfies BrowserContextOptions

/** Desktop BYOA / library-result shots. */
export const CAPTURE_DESKTOP = {
  viewport: { width: 1280, height: 800 },
  colorScheme: "dark",
} as const satisfies BrowserContextOptions

export function phoneContextOptions(
  overrides: BrowserContextOptions = {},
): BrowserContextOptions {
  return {
    ...CAPTURE_PHONE,
    storageState: AUTH_STATE,
    ...overrides,
  }
}

export function desktopContextOptions(
  overrides: BrowserContextOptions = {},
): BrowserContextOptions {
  return {
    ...CAPTURE_DESKTOP,
    storageState: AUTH_STATE,
    ...overrides,
  }
}

const ORIGIN_CANDIDATES = [
  process.env.CAPTURE_APP_ORIGIN?.trim(),
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
].filter((o): o is string => Boolean(o))

export async function isReachable(origin: string): Promise<boolean> {
  try {
    await fetch(origin, { method: "GET", redirect: "follow" })
    return true
  } catch {
    return false
  }
}

export async function resolveAppOrigin(): Promise<string> {
  const explicit = process.env.CAPTURE_APP_ORIGIN?.trim()
  if (explicit) {
    if (!(await isReachable(explicit))) {
      console.error(
        `CAPTURE_APP_ORIGIN=${explicit} is not reachable.\n` +
          "Start `npm run dev:hosted` and use the Local URL Vite prints.",
      )
      process.exit(1)
    }
    return explicit
  }

  for (const origin of ORIGIN_CANDIDATES) {
    if (await isReachable(origin)) {
      if (!origin.includes(":5173")) {
        console.log(`[capture] Using ${origin}`)
      }
      return origin
    }
  }

  console.error(
    "No Vite app reachable.\nStart: npm run dev:hosted\n" +
      "Then: CAPTURE_APP_ORIGIN=http://localhost:<port> …",
  )
  process.exit(1)
}

export function assertAuthReady() {
  if (!fs.existsSync(AUTH_STATE)) {
    console.error(
      `Missing ${AUTH_STATE}\nRun: PRIME_MOVER_PASSWORD=… npx tsx scripts/capture-tour-auth.ts`,
    )
    process.exit(1)
  }
  const hosted = resolveHostedViteEnv()
  const expectedKey = authStorageKey(hosted.VITE_SUPABASE_URL)
  const state = JSON.parse(fs.readFileSync(AUTH_STATE, "utf8")) as {
    origins?: { localStorage?: { name: string }[] }[]
  }
  const names = state.origins?.[0]?.localStorage?.map((e) => e.name) ?? []
  if (!names.includes(expectedKey)) {
    console.error(
      `Auth state has no ${expectedKey}. Re-run capture-tour-auth.ts against hosted.`,
    )
    process.exit(1)
  }
}

export async function dismissNoise(page: import("@playwright/test").Page) {
  const dialog = page.getByRole("dialog", { name: /enable notifications/i })
  try {
    await dialog.waitFor({ state: "visible", timeout: 2500 })
    await dialog.getByRole("button", { name: /not now/i }).click()
  } catch {
    /* none */
  }
}

export async function assertAuthenticated(page: import("@playwright/test").Page) {
  const loginShell = page.getByText(/strength training, simplified/i)
  if (await loginShell.isVisible().catch(() => false)) {
    throw new Error(
      "Landed on login shell — use npm run dev:hosted + refresh capture-tour-auth.",
    )
  }
}

/**
 * Trim trailing near-empty chrome from a phone capture.
 *
 * Full-viewport shots at 390×844 still leave a dead band when the app UI is
 * shorter than the bezel (sheets, short previews). DeviceFrame uses
 * `object-cover` + focal, so a slightly shorter PNG fills cleanly instead of
 * showing empty app background inside the phone.
 *
 * Conservative: only crops when ≥1.5% of the bottom is empty, never more than
 * 35% of height, keeps `padPx` of breathing room under the last bright UI.
 */
export async function trimTrailingEmptyChrome(
  pngPath: string,
  opts: { padPx?: number; minEmptyRatio?: number; maxTrimRatio?: number } = {},
): Promise<{ trimmedPx: number; height: number }> {
  const padPx = opts.padPx ?? 24
  const minEmptyRatio = opts.minEmptyRatio ?? 0.015
  const maxTrimRatio = opts.maxTrimRatio ?? 0.35

  const { data, info } = await sharp(pngPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width: w, height: h, channels: c } = info

  const sample = (x: number, y: number) => {
    const i = (y * w + x) * c
    return (data[i]! + data[i + 1]! + data[i + 2]!) / 3
  }
  const bg =
    (sample(2, 2) + sample(w - 3, 2) + sample(2, h - 3) + sample(w - 3, h - 3)) /
    4

  let lastStrong = 0
  for (let y = 0; y < h; y++) {
    let bright = 0
    let n = 0
    for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * c
      const v = (data[i]! + data[i + 1]! + data[i + 2]!) / 3
      if (v > bg + 40) bright++
      n++
    }
    if (bright / n > 0.01) lastStrong = y
  }

  const contentBottom = Math.min(h, lastStrong + 1 + padPx)
  const emptyPx = h - contentBottom
  if (emptyPx / h < minEmptyRatio) {
    return { trimmedPx: 0, height: h }
  }
  const maxTrim = Math.floor(h * maxTrimRatio)
  const newH = Math.max(contentBottom, h - maxTrim)
  if (newH >= h) return { trimmedPx: 0, height: h }

  const tmp = path.join(
    os.tmpdir(),
    `tour-trim-${process.pid}-${Date.now()}.png`,
  )
  await sharp(pngPath)
    .extract({ left: 0, top: 0, width: w, height: newH })
    .png()
    .toFile(tmp)
  fs.renameSync(tmp, pngPath)
  return { trimmedPx: h - newH, height: newH }
}

export async function shot(
  page: import("@playwright/test").Page,
  id: string,
  opts: { trimEmpty?: boolean } = {},
): Promise<string> {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const out = path.join(OUT_DIR, `${id}.png`)
  await page.waitForTimeout(400)
  await page.screenshot({ path: out, fullPage: false })
  if (opts.trimEmpty !== false) {
    const { trimmedPx, height } = await trimTrailingEmptyChrome(out)
    if (trimmedPx > 0) {
      console.log(`  → ${out} (trimmed ${trimmedPx}px → h=${height})`)
      return out
    }
  }
  console.log(`  → ${out}`)
  return out
}
