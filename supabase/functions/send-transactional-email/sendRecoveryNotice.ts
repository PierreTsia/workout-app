/**
 * One-off sender for the session-recovery notice (#568).
 *
 * Publishes nothing: run `publishRecoveryTemplate.ts` first. This reads a
 * recipients JSON (kept out of the repo) and sends one Resend template email per
 * entry. No transactional_email_log write.
 *
 *   RESEND_API_KEY=re_xxx FROM_EMAIL="GymLogic <admin@gymlogic.me>" \
 *     deno run --allow-env --allow-net --allow-read \
 *     supabase/functions/send-transactional-email/sendRecoveryNotice.ts \
 *     --recipients /tmp/recovery-recipients.json --send
 *
 * `--to you@example.com` diverts every mail to one inbox (dry preview). Without
 * `--send` the script prints the plan only. A present-but-valueless flag aborts.
 *
 * Recipients JSON shape:
 *   [{
 *     "to": "user@example.com",
 *     "sessionDate": "29 September",
 *     "sessionLabel": "Tag C – Ganzkörper-Kombi + Beine",
 *     "setCount": 15,
 *     "duration": "about 80 minutes",
 *     "badges": [
 *       { "iconUrl": "https://…/badge-icons/exercise_variety_silver.webp",
 *         "track": "Variety", "rank": "silver",
 *         "title": "The Explorer", "threshold": "15 different exercises" }
 *     ]
 *   }]
 */
import { Resend } from "npm:resend@6.28.1"
import { buildRecoverySend, type RecoveryBadge } from "./recovery.ts"

type Recipient = {
  to: string
  sessionDate: string
  sessionLabel: string
  setCount: number
  duration: string
  badges: RecoveryBadge[]
}

/**
 * Value of a flag, or null when the flag is absent. Aborts when the flag is
 * present without a value — a preview `--to` that silently drops its value would
 * send real mail, so it must fail closed.
 */
function flagValue(flag: string): string | null {
  const i = Deno.args.indexOf(flag)
  if (i === -1) return null
  const value = Deno.args[i + 1]
  if (!value || value.startsWith("--")) {
    console.error(`${flag} needs a value`)
    Deno.exit(1)
  }
  return value
}

function fail(message: string): never {
  console.error(message)
  Deno.exit(1)
  // Unreachable under Deno; present so TypeScript sees a `never` body end.
  throw new Error(message)
}

function parseRecipient(raw: unknown, index: number): Recipient {
  if (typeof raw !== "object" || raw === null) {
    fail(`recipient ${index}: not an object`)
  }
  const r = raw as Record<string, unknown>
  const str = (key: string): string => {
    const v = r[key]
    if (typeof v !== "string" || !v.trim()) fail(`recipient ${index}: ${key} must be a non-empty string`)
    return v
  }
  if (typeof r.setCount !== "number" || !Number.isFinite(r.setCount)) {
    fail(`recipient ${index}: setCount must be a number`)
  }
  if (!Array.isArray(r.badges) || r.badges.length === 0) {
    // The copy states the session "pushed you past an achievement" — with no
    // badge that becomes a false claim, so require at least one.
    fail(`recipient ${index}: badges must be a non-empty array`)
  }
  const badges = r.badges.map((b, j): RecoveryBadge => {
    if (typeof b !== "object" || b === null) fail(`recipient ${index} badge ${j}: not an object`)
    const br = b as Record<string, unknown>
    const bs = (key: string): string => {
      const v = br[key]
      if (typeof v !== "string" || !v.trim()) fail(`recipient ${index} badge ${j}: ${key} must be a non-empty string`)
      return v
    }
    return {
      iconUrl: bs("iconUrl"),
      track: bs("track"),
      rank: bs("rank"),
      title: bs("title"),
      threshold: bs("threshold"),
    }
  })
  return {
    to: str("to"),
    sessionDate: str("sessionDate"),
    sessionLabel: str("sessionLabel"),
    setCount: r.setCount,
    duration: str("duration"),
    badges,
  }
}

const apiKey = Deno.env.get("RESEND_API_KEY")?.trim()
if (!apiKey) fail("RESEND_API_KEY is required")

const recipientsPath = flagValue("--recipients")
if (!recipientsPath) fail("--recipients <json-file> is required")

const overrideTo = flagValue("--to")
const send = Deno.args.includes("--send")
const from = Deno.env.get("FROM_EMAIL")?.trim() || "GymLogic <admin@gymlogic.me>"

const parsed: unknown = JSON.parse(Deno.readTextFileSync(recipientsPath))
if (!Array.isArray(parsed) || parsed.length === 0) {
  fail("recipients file is empty")
}
const recipients = parsed.map(parseRecipient)

const resend = new Resend(apiKey)

console.log(send ? "SEND mode" : "DRY RUN (pass --send to send)")

const failures: string[] = []

for (const r of recipients) {
  const to = overrideTo || r.to
  const { subject, template } = buildRecoverySend({
    sessionDate: r.sessionDate,
    sessionLabel: r.sessionLabel,
    setCount: r.setCount,
    duration: r.duration,
    badges: r.badges,
  })

  if (!send) {
    console.log(
      `would send → ${to}: ${subject} (${template.id}; ${r.badges.length} badge(s) to "${r.sessionLabel}" on ${r.sessionDate})`,
    )
    continue
  }

  const { data, error } = await resend.emails.send({
    from,
    to,
    replyTo: "admin@gymlogic.me",
    subject,
    template,
  })

  if (error) {
    // Keep going: aborting mid-list would leave a retry re-sending the entries
    // that already went out.
    console.error(`send failed → ${to}:`, error.message)
    failures.push(to)
    continue
  }

  const id = data && typeof data === "object" && "id" in data ? data.id : "?"
  console.log(`sent → ${to}: messageId=${id}`)
}

if (failures.length > 0) {
  fail(`/!\\ ${failures.length} send(s) failed: ${failures.join(", ")}`)
}
