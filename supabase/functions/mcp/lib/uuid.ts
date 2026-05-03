/**
 * Generic UUID *shape* check — fails fast on garbage input before hitting Postgres.
 * Does NOT enforce version/variant bits, so it accepts v1/v3/v4/v5 alike.
 * If you ever need strict v4 validation (Postgres `gen_random_uuid()` output),
 * tighten this regex to `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`.
 */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(s: string): boolean {
  return UUID_RE.test(s)
}
