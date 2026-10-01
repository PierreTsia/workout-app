/**
 * The public, unauthenticated version read for the SPA. Matches the `/version`
 * path suffix exactly (so `/versions` is not the version route) and returns the
 * single release number to serialize — or null when the path is not it.
 */
export function versionResponse(
  pathname: string,
  version: string,
): { version: string } | null {
  return pathname.endsWith("/version") ? { version } : null
}
