import { lazy, type ComponentType, type LazyExoticComponent } from "react"

// #356 — `React.lazy` rejects with `TypeError: Failed to fetch dynamically
// imported module` when the chunk hash on disk no longer matches what the
// running tab remembers (typical after a deploy: SW or browser cache holds
// the old `index.html`, the new server serves a 404 page with `text/html`
// MIME for the missing chunk, the browser refuses to execute it as JS).
//
// Strategy: catch the failure in the loader wrapper, reload the page once
// to pull a fresh `index.html` + fresh chunk hashes. A sessionStorage
// guard prevents an infinite reload loop when the reload itself fails to
// recover (CDN issue, broken build, offline). On the second failure we
// let the error bubble to `RouteErrorFallback`, which surfaces a "Force
// refresh" button wired to `forceHardReload` — the nuclear option that
// also clears caches and unregisters the service worker.

const RELOAD_KEY = "chunk-load-reload-attempted-at"
const RELOAD_GUARD_MS = 60_000

const CHUNK_FAILURE_NEEDLES = [
  "Failed to fetch dynamically imported module",
  "Importing a module script failed",
  "error loading dynamically imported module",
] as const

export function isChunkLoadFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return CHUNK_FAILURE_NEEDLES.some((needle) => error.message.includes(needle))
}

function readReloadGuard(now: number): boolean {
  try {
    const stored = sessionStorage.getItem(RELOAD_KEY)
    if (!stored) return false
    const ts = Number.parseInt(stored, 10)
    if (Number.isNaN(ts)) return false
    return now - ts < RELOAD_GUARD_MS
  } catch {
    return false
  }
}

function writeReloadGuard(now: number): void {
  try {
    sessionStorage.setItem(RELOAD_KEY, String(now))
  } catch {
    // sessionStorage may be unavailable (Safari private mode, etc.).
    // Worst case: the loop guard is disabled and we reload more than
    // once — still bounded by user closing the tab.
  }
}

function clearReloadGuard(): void {
  try {
    sessionStorage.removeItem(RELOAD_KEY)
  } catch {
    // ignore
  }
}

interface RecoveryDeps {
  // Injected only by tests — production always uses the real `window`.
  reload?: () => void
  now?: () => number
}

/**
 * Wraps a `React.lazy` loader so chunk-load failures trigger a single
 * `window.location.reload()` (gated by sessionStorage to avoid loops).
 *
 * Exported separately from `lazyWithRecover` so the recovery logic can
 * be unit-tested without reaching into React.lazy internals. The
 * wrapper around `lazy()` is just plumbing.
 */
export function createRecoveringLoader<T extends ComponentType<unknown>>(
  loader: () => Promise<{ default: T }>,
  deps: RecoveryDeps = {},
): () => Promise<{ default: T }> {
  const reload = deps.reload ?? (() => window.location.reload())
  const now = deps.now ?? (() => Date.now())

  return async () => {
    try {
      return await loader()
    } catch (err) {
      if (!isChunkLoadFailure(err)) throw err
      if (readReloadGuard(now())) throw err

      writeReloadGuard(now())
      reload()
      // Park the promise so React keeps the Suspense fallback up while
      // the reload kicks in. Resolving/rejecting here would either flash
      // the wrong UI or push the user into the error boundary right
      // before the page tears down.
      return new Promise<{ default: T }>(() => {})
    }
  }
}

export function lazyWithRecover<T extends ComponentType<unknown>>(
  loader: () => Promise<{ default: T }>,
  deps: RecoveryDeps = {},
): LazyExoticComponent<T> {
  return lazy(createRecoveringLoader(loader, deps))
}

/**
 * Nuke local caches + unregister the service worker, then hard-reload.
 * Used by `RouteErrorFallback` when the soft reload from
 * `lazyWithRecover` didn't recover (loop guard tripped). This is the
 * escape hatch when the SW is serving stale chunks indefinitely.
 *
 * Best-effort: every step is wrapped so a single failure doesn't block
 * the final `location.reload()`.
 */
export async function forceHardReload(): Promise<void> {
  try {
    if (typeof window !== "undefined" && "caches" in window) {
      const names = await caches.keys()
      await Promise.all(names.map((name) => caches.delete(name)))
    }
  } catch {
    // ignore
  }
  try {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
  } catch {
    // ignore
  }
  clearReloadGuard()
  if (typeof window !== "undefined") window.location.reload()
}
