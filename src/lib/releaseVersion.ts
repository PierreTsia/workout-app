declare const __RELEASE_VERSION__: string

export const GITHUB_RELEASES_URL =
  "https://github.com/PierreTsia/workout-app/releases"

/**
 * The version baked into this build from `package.json` (vite `define`), used
 * as the offline / first-paint fallback. Vitest does not apply the SPA
 * `define`, so `__RELEASE_VERSION__` is absent there — hence the `typeof` guard
 * (same pattern as `__APP_VERSION__` in `@/lib/errorReport`).
 */
export const BUILD_RELEASE_VERSION =
  typeof __RELEASE_VERSION__ === "string" ? __RELEASE_VERSION__ : "unknown"

/**
 * Reads the single release version from the deployed MCP Edge Function — the
 * same `SERVER_INFO.version` external agents read, which release-please bumps
 * on every release. Fails soft (offline, 5xx, bad shape) by returning null so
 * callers fall back to `BUILD_RELEASE_VERSION`.
 */
export async function fetchReleaseVersion(): Promise<string | null> {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined
  if (!base) return null
  try {
    const res = await fetch(`${base}/functions/v1/mcp/version`)
    if (!res.ok) return null
    const data = (await res.json()) as { version?: unknown }
    return typeof data.version === "string" && data.version.length > 0
      ? data.version
      : null
  } catch {
    return null
  }
}
