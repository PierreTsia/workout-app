import type { Session } from "@supabase/supabase-js"
import type { User } from "@/types/auth"

export interface BootstrapAuthOptions {
  /** Function returning the supabase getSession() promise. Indirected for testability. */
  getSession: () => Promise<{ data: { session: Session | null } }>
  setAuth: (user: User | null) => void
  setLoading: (loading: boolean) => void
  /** Called once with the user when bootstrap surfaces a real session. */
  onUser?: (user: User) => void
  /**
   * Hard cap on how long we wait for `getSession()` before giving up and booting
   * the app as logged-out. supabase-js can hang internally when the stored JWT
   * is expired and the silent token refresh request never resolves on a flaky
   * network — without a timeout `authLoadingAtom` would stay `true` forever and
   * `AuthGuard` would render `null` (= literal black screen).
   */
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 5000

class AuthBootstrapTimeoutError extends Error {
  constructor(ms: number) {
    super(`auth bootstrap timed out after ${ms}ms`)
    this.name = "AuthBootstrapTimeoutError"
  }
}

/**
 * Resolves the initial auth session and flips `authLoadingAtom = false` no
 * matter what. Always-resolving by design — three exit paths:
 *
 *  1. `getSession()` resolves → propagate the user (or `null`)
 *  2. `getSession()` rejects → swallow + set user `null` (continue offline)
 *  3. `timeoutMs` elapses first → swallow + set user `null` (continue offline)
 *
 * In (2) and (3) the supabase `onAuthStateChange` listener will still pick up
 * a recovered session later, so the user transparently lands back into auth
 * once the network is healthy again.
 *
 * Returns `void` because callers (the supabase module top-level) just need to
 * fire-and-forget; they do not branch on the outcome.
 */
export async function bootstrapAuth(opts: BootstrapAuthOptions): Promise<void> {
  const {
    getSession,
    setAuth,
    setLoading,
    onUser,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = opts

  let timer: ReturnType<typeof setTimeout> | undefined

  // Defensive `safe(...)` wrapper: every store mutation here must be guarded
  // because `bootstrapAuth` is the one place where a thrown exception means
  // the app never paints (loading would stay `true`). Empirically `store.set`
  // doesn't throw, but we don't want a future atom-with-side-effects to
  // re-introduce the black-screen failure mode.
  const safe = (fn: () => void) => {
    try {
      fn()
    } catch (error) {
      console.warn("[auth] bootstrap callback threw, swallowing", error)
    }
  }

  try {
    const result = await Promise.race([
      getSession(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new AuthBootstrapTimeoutError(timeoutMs)),
          timeoutMs,
        )
      }),
    ])

    const user = (result.data.session?.user ?? null) as User | null
    safe(() => setAuth(user))
    if (user && onUser) {
      safe(() => onUser(user))
    }
  } catch (error) {
    if (error instanceof AuthBootstrapTimeoutError) {
      console.warn("[auth] bootstrap timed out, continuing offline", error)
    } else {
      console.warn("[auth] bootstrap failed, continuing offline", error)
    }
    safe(() => setAuth(null))
  } finally {
    if (timer !== undefined) clearTimeout(timer)
    safe(() => setLoading(false))
  }
}
