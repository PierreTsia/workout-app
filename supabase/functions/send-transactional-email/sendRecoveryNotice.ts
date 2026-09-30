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
 *     --recipients /tmp/recovery-recipients.json
 *
 * Add `--to you@example.com` to divert every mail to one inbox (dry preview).
 * Add `--send` to actually send; without it the script prints the plan only.
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

function arg(flag: string): string | null {
  const i = Deno.args.indexOf(flag)
  if (i === -1) return null
  const value = Deno.args[i + 1]
  return value && !value.startsWith("--") ? value : null
}

const apiKey = Deno.env.get("RESEND_API_KEY")?.trim()
if (!apiKey) {
  console.error("RESEND_API_KEY is required")
  Deno.exit(1)
}

const recipientsPath = arg("--recipients")
if (!recipientsPath) {
  console.error("--recipients <json-file> is required")
  Deno.exit(1)
}

const overrideTo = arg("--to")
const send = Deno.args.includes("--send")
const from =
  Deno.env.get("FROM_EMAIL")?.trim() || "GymLogic <admin@gymlogic.me>"

const recipients = JSON.parse(
  Deno.readTextFileSync(recipientsPath),
) as Recipient[]

if (!Array.isArray(recipients) || recipients.length === 0) {
  console.error("recipients file is empty")
  Deno.exit(1)
}

const resend = new Resend(apiKey)

console.log(send ? "SEND mode" : "DRY RUN (pass --send to send)")

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
    console.error(`send failed → ${to}:`, error.message)
    Deno.exit(1)
  }

  const id = data && typeof data === "object" && "id" in data ? data.id : "?"
  console.log(`sent → ${to}: messageId=${id}`)
}
