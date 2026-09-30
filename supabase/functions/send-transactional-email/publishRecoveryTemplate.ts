/**
 * Create or update the published Resend session-recovery template.
 *
 *   RESEND_API_KEY=re_xxx deno run --allow-env --allow-net \
 *     supabase/functions/send-transactional-email/publishRecoveryTemplate.ts
 */
import { Resend } from "npm:resend@6.28.1"
import {
  DEFAULT_RECOVERY_TEMPLATE_ID,
  RECOVERY_SUBJECT,
  RECOVERY_TEMPLATE_HTML,
  RECOVERY_TEMPLATE_VARIABLES,
} from "./recovery.ts"

const apiKey = Deno.env.get("RESEND_API_KEY")?.trim()
if (!apiKey) {
  console.error("RESEND_API_KEY is required")
  Deno.exit(1)
}

const from =
  Deno.env.get("FROM_EMAIL")?.trim() || "GymLogic <admin@gymlogic.me>"

const resend = new Resend(apiKey)

const listed = await resend.templates.list({ limit: 100 })
if (listed.error) {
  console.error("list templates failed", listed.error)
  Deno.exit(1)
}

const existing = listed.data?.data.find(
  (t) => t.alias === DEFAULT_RECOVERY_TEMPLATE_ID,
)

const payload = {
  name: "Session Recovery Notice",
  alias: DEFAULT_RECOVERY_TEMPLATE_ID,
  from,
  subject: RECOVERY_SUBJECT,
  html: RECOVERY_TEMPLATE_HTML,
  variables: RECOVERY_TEMPLATE_VARIABLES,
}

if (existing) {
  const updated = await resend.templates.update(existing.id, payload)
  if (updated.error) {
    console.error("update template failed", updated.error)
    Deno.exit(1)
  }
  const published = await resend.templates.publish(existing.id)
  if (published.error) {
    console.error("publish template failed", published.error)
    Deno.exit(1)
  }
  console.log("updated and published", existing.id, DEFAULT_RECOVERY_TEMPLATE_ID)
} else {
  const created = await resend.templates.create(payload)
  if (created.error || !created.data) {
    console.error("create template failed", created.error)
    Deno.exit(1)
  }
  const published = await resend.templates.publish(created.data.id)
  if (published.error) {
    console.error("publish template failed", published.error)
    Deno.exit(1)
  }
  console.log("created and published", created.data.id, DEFAULT_RECOVERY_TEMPLATE_ID)
}
