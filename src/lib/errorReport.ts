declare const __APP_VERSION__: string

const ID_HEX_LENGTH = 6
const FNV_OFFSET_BASIS = 0x811c9dc5
const FNV_PRIME = 0x01000193

/**
 * Short hash derived from the error's message — i.e. its "signature".
 * The same crash twice in a row (whether across one render or two
 * sessions) yields the same ID, which is the property we want for a
 * user-facing handle: paste-able, deduplicable, and stable across
 * React's DEV-mode re-renders (which mint fresh `Error` instances with
 * different stacks on each attempt).
 *
 * Stack is intentionally NOT in the seed — it varies by render attempt
 * (React schedules different frames each time) so including it would
 * break the "stable handle" property. The message-only signature gives
 * good-enough dedup for a UX cue; Sentry has the full event for triage.
 *
 * Not cryptographic — just FNV-1a folded to 6 hex chars.
 */
export function makeErrorId(error: Error): string {
  const seed = error.message || "(no-message)"
  const hash = Array.from(seed).reduce((acc, ch) => {
    const xor = acc ^ ch.charCodeAt(0)
    return Math.imul(xor, FNV_PRIME) >>> 0
  }, FNV_OFFSET_BASIS >>> 0)
  return `err_${hash.toString(16).padStart(8, "0").slice(0, ID_HEX_LENGTH)}`
}

export interface ErrorReport {
  id: string
  message: string
  stack: string | null
  componentStack: string | null
  route: string
  userAgent: string
  appVersion: string
  timestamp: string
}

interface BuildErrorReportArgs {
  id: string
  error: Error
  componentStack?: string | null
  route?: string
  userAgent?: string
  appVersion?: string
  now?: Date
}

function readAppVersion(): string {
  try {
    return typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "unknown"
  } catch {
    return "unknown"
  }
}

function readRoute(): string {
  if (typeof window === "undefined") return ""
  const { pathname, search, hash } = window.location
  return `${pathname}${search}${hash}`
}

function readUserAgent(): string {
  return typeof navigator !== "undefined" ? navigator.userAgent : ""
}

export function buildErrorReport(args: BuildErrorReportArgs): ErrorReport {
  return {
    id: args.id,
    message: args.error.message,
    stack: args.error.stack ?? null,
    componentStack: args.componentStack ?? null,
    route: args.route ?? readRoute(),
    userAgent: args.userAgent ?? readUserAgent(),
    appVersion: args.appVersion ?? readAppVersion(),
    timestamp: (args.now ?? new Date()).toISOString(),
  }
}

/**
 * Markdown-formatted dump suitable for pasting into a GitHub issue or
 * a chat message. We keep it dense — no banner, no friendly copy — so
 * the consumer (likely the dev) sees only signal.
 */
export function formatReportAsMarkdown(report: ErrorReport): string {
  const lines = [
    `**Error ID:** \`${report.id}\``,
    `**When:** ${report.timestamp}`,
    `**Route:** \`${report.route || "(unknown)"}\``,
    `**App version:** \`${report.appVersion}\``,
    `**User agent:** \`${report.userAgent || "(unknown)"}\``,
    "",
    "**Message**",
    "```",
    report.message || "(empty)",
    "```",
  ]
  if (report.stack) {
    lines.push("", "**Stack**", "```", report.stack, "```")
  }
  if (report.componentStack) {
    lines.push("", "**Component stack**", "```", report.componentStack, "```")
  }
  return lines.join("\n")
}
