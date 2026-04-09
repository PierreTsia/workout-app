import { Resend } from "npm:resend@4.0.1"
import { signUnsubscribeToken, unsubscribeSecret } from "../_shared/unsubscribeToken.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { createServiceClient } from "../_shared/supabase.ts"
import { buildFeedbackAckEmail, buildFeedbackResolvedEmail } from "./feedback.ts"
import { buildWelcomeEmail } from "./welcome.ts"

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE"
  table: string
  schema: string
  record: Record<string, unknown> | null
  old_record: Record<string, unknown> | null
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function parseSkipDomains(): string[] {
  const raw = Deno.env.get("SKIP_EMAIL_DOMAINS")?.trim()
  if (!raw) return []
  return raw.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean)
}

function shouldSkipEmailForDomain(email: string, domains: string[]): boolean {
  const lower = email.toLowerCase()
  return domains.some((d) => lower.endsWith(`@${d}`) || lower === d)
}

function edgeFunctionOrigin(): string {
  return Deno.env.get("SUPABASE_URL")?.trim().replace(/\/$/, "") ?? ""
}

async function buildUnsubscribeUrl(userId: string): Promise<string | null> {
  const secret = unsubscribeSecret()
  if (!secret) return null
  const exp = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60
  const token = await signUnsubscribeToken({ u: userId, exp, p: "feedback" }, secret)
  const base = edgeFunctionOrigin()
  if (!base) return null
  return `${base}/functions/v1/email-unsubscribe?token=${encodeURIComponent(token)}`
}

async function feedbackNotificationsEnabled(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("user_email_preferences")
    .select("feedback_notifications")
    .eq("user_id", userId)
    .maybeSingle()
  if (!data) return true
  return data.feedback_notifications !== false
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  const secret = Deno.env.get("WEBHOOK_SECRET")
  const authHeader = req.headers.get("Authorization")
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return jsonResponse({ error: "Unauthorized" }, 401)
  }

  let payload: WebhookPayload
  try {
    payload = (await req.json()) as WebhookPayload
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400)
  }

  if (
    payload.schema === "auth" &&
    payload.table === "users" &&
    payload.type === "INSERT" &&
    payload.record
  ) {
    return await handleAuthUserInsert(payload.record)
  }

  if (
    payload.schema === "public" &&
    payload.table === "exercise_content_feedback"
  ) {
    if (payload.type === "INSERT" && payload.record) {
      return await handleFeedbackInsert(payload.record)
    }
    if (payload.type === "UPDATE" && payload.record && payload.old_record) {
      return await handleFeedbackUpdate(payload.record, payload.old_record)
    }
  }

  return jsonResponse({ ok: true, ignored: true })
})

async function handleAuthUserInsert(record: Record<string, unknown>) {
  const userId = typeof record.id === "string" ? record.id : null
  const email = typeof record.email === "string" ? record.email : null

  if (!userId) {
    return jsonResponse({ ok: false, error: "missing user id" }, 400)
  }

  if (!email?.trim()) {
    return jsonResponse({ ok: true, skipped: "no email" })
  }

  const skipDomains = parseSkipDomains()
  if (shouldSkipEmailForDomain(email, skipDomains)) {
    console.log("send-transactional-email: skip domain", email)
    return jsonResponse({ ok: true, skipped: "domain" })
  }

  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .from("transactional_email_log")
    .select("id")
    .eq("user_id", userId)
    .eq("email_kind", "welcome")
    .maybeSingle()

  if (existing) {
    return jsonResponse({ ok: true, skipped: "already sent" })
  }

  const resendKey = Deno.env.get("RESEND_API_KEY")
  const fromEmail = Deno.env.get("FROM_EMAIL")?.trim()
  const appName = Deno.env.get("APP_NAME")?.trim()

  if (!resendKey || !fromEmail) {
    console.error("send-transactional-email: missing RESEND_API_KEY or FROM_EMAIL")
    return jsonResponse({ error: "Server misconfigured" }, 500)
  }

  const { subject, html } = buildWelcomeEmail({ appName })
  const resend = new Resend(resendKey)

  const { data: sendData, error: sendErr } = await resend.emails.send({
    from: fromEmail,
    to: email,
    subject,
    html,
  })

  if (sendErr) {
    console.error("send-transactional-email: Resend error", sendErr)
    return jsonResponse({ error: "Send failed", details: sendErr.message }, 502)
  }

  const providerId =
    sendData && typeof sendData === "object" && "id" in sendData
      ? String((sendData as { id: string }).id)
      : null

  const { error: insertErr } = await supabase.from("transactional_email_log").insert({
    user_id: userId,
    email_kind: "welcome",
    feedback_id: null,
    provider_id: providerId,
  })

  if (insertErr) {
    console.error("send-transactional-email: log insert error", insertErr)
    if (insertErr.code === "23505") {
      return jsonResponse({ ok: true, skipped: "duplicate log" })
    }
    return jsonResponse({ error: "Log failed", details: insertErr.message }, 500)
  }

  return jsonResponse({ ok: true, messageId: providerId })
}

async function handleFeedbackInsert(record: Record<string, unknown>) {
  const feedbackId = typeof record.id === "string" ? record.id : null
  const userId = typeof record.user_id === "string" ? record.user_id : null
  const userEmail = typeof record.user_email === "string" ? record.user_email : null

  if (!feedbackId || !userId) {
    return jsonResponse({ ok: false, error: "missing feedback id or user id" }, 400)
  }

  if (!userEmail?.trim()) {
    return jsonResponse({ ok: true, skipped: "no user email" })
  }

  const skipDomains = parseSkipDomains()
  if (shouldSkipEmailForDomain(userEmail, skipDomains)) {
    return jsonResponse({ ok: true, skipped: "domain" })
  }

  const supabase = createServiceClient()

  if (!(await feedbackNotificationsEnabled(supabase, userId))) {
    return jsonResponse({ ok: true, skipped: "notifications off" })
  }

  const { data: existing } = await supabase
    .from("transactional_email_log")
    .select("id")
    .eq("feedback_id", feedbackId)
    .eq("email_kind", "feedback_ack")
    .maybeSingle()

  if (existing) {
    return jsonResponse({ ok: true, skipped: "already sent ack" })
  }

  const resendKey = Deno.env.get("RESEND_API_KEY")
  const fromEmail = Deno.env.get("FROM_EMAIL")?.trim()
  if (!resendKey || !fromEmail) {
    console.error("send-transactional-email: missing RESEND_API_KEY or FROM_EMAIL")
    return jsonResponse({ error: "Server misconfigured" }, 500)
  }

  const unsubscribeUrl = await buildUnsubscribeUrl(userId)
  if (!unsubscribeUrl) {
    console.error("send-transactional-email: could not build unsubscribe URL")
    return jsonResponse({ error: "Server misconfigured" }, 500)
  }

  const { subject, html } = buildFeedbackAckEmail({ unsubscribeUrl })
  const resend = new Resend(resendKey)

  const listUnsubscribe = `<${unsubscribeUrl}>`
  const { data: sendData, error: sendErr } = await resend.emails.send({
    from: fromEmail,
    to: userEmail,
    subject,
    html,
    headers: { "List-Unsubscribe": listUnsubscribe },
  })

  if (sendErr) {
    console.error("send-transactional-email: feedback ack Resend error", sendErr)
    return jsonResponse({ error: "Send failed", details: sendErr.message }, 502)
  }

  const providerId =
    sendData && typeof sendData === "object" && "id" in sendData
      ? String((sendData as { id: string }).id)
      : null

  const { error: insertErr } = await supabase.from("transactional_email_log").insert({
    user_id: userId,
    email_kind: "feedback_ack",
    feedback_id: feedbackId,
    provider_id: providerId,
  })

  if (insertErr) {
    console.error("send-transactional-email: feedback ack log error", insertErr)
    if (insertErr.code === "23505") {
      return jsonResponse({ ok: true, skipped: "duplicate ack log" })
    }
    return jsonResponse({ error: "Log failed", details: insertErr.message }, 500)
  }

  return jsonResponse({ ok: true, kind: "feedback_ack", messageId: providerId })
}

async function handleFeedbackUpdate(
  record: Record<string, unknown>,
  oldRecord: Record<string, unknown>,
) {
  const oldStatus = typeof oldRecord.status === "string" ? oldRecord.status : ""
  const newStatus = typeof record.status === "string" ? record.status : ""
  if (oldStatus === "resolved" || newStatus !== "resolved") {
    return jsonResponse({ ok: true, ignored: "not a resolve transition" })
  }

  const feedbackId = typeof record.id === "string" ? record.id : null
  const userId = typeof record.user_id === "string" ? record.user_id : null
  const userEmail = typeof record.user_email === "string" ? record.user_email : null

  if (!feedbackId || !userId) {
    return jsonResponse({ ok: false, error: "missing feedback id or user id" }, 400)
  }

  if (!userEmail?.trim()) {
    return jsonResponse({ ok: true, skipped: "no user email" })
  }

  const skipDomains = parseSkipDomains()
  if (shouldSkipEmailForDomain(userEmail, skipDomains)) {
    return jsonResponse({ ok: true, skipped: "domain" })
  }

  const supabase = createServiceClient()

  if (!(await feedbackNotificationsEnabled(supabase, userId))) {
    return jsonResponse({ ok: true, skipped: "notifications off" })
  }

  const { data: existing } = await supabase
    .from("transactional_email_log")
    .select("id")
    .eq("feedback_id", feedbackId)
    .eq("email_kind", "feedback_resolved")
    .maybeSingle()

  if (existing) {
    return jsonResponse({ ok: true, skipped: "already sent resolved" })
  }

  const resendKey = Deno.env.get("RESEND_API_KEY")
  const fromEmail = Deno.env.get("FROM_EMAIL")?.trim()
  if (!resendKey || !fromEmail) {
    console.error("send-transactional-email: missing RESEND_API_KEY or FROM_EMAIL")
    return jsonResponse({ error: "Server misconfigured" }, 500)
  }

  const unsubscribeUrl = await buildUnsubscribeUrl(userId)
  if (!unsubscribeUrl) {
    console.error("send-transactional-email: could not build unsubscribe URL")
    return jsonResponse({ error: "Server misconfigured" }, 500)
  }

  const { subject, html } = buildFeedbackResolvedEmail({ unsubscribeUrl })
  const resend = new Resend(resendKey)
  const listUnsubscribe = `<${unsubscribeUrl}>`

  const { data: sendData, error: sendErr } = await resend.emails.send({
    from: fromEmail,
    to: userEmail,
    subject,
    html,
    headers: { "List-Unsubscribe": listUnsubscribe },
  })

  if (sendErr) {
    console.error("send-transactional-email: feedback resolved Resend error", sendErr)
    return jsonResponse({ error: "Send failed", details: sendErr.message }, 502)
  }

  const providerId =
    sendData && typeof sendData === "object" && "id" in sendData
      ? String((sendData as { id: string }).id)
      : null

  const { error: insertErr } = await supabase.from("transactional_email_log").insert({
    user_id: userId,
    email_kind: "feedback_resolved",
    feedback_id: feedbackId,
    provider_id: providerId,
  })

  if (insertErr) {
    console.error("send-transactional-email: feedback resolved log error", insertErr)
    if (insertErr.code === "23505") {
      return jsonResponse({ ok: true, skipped: "duplicate resolved log" })
    }
    return jsonResponse({ error: "Log failed", details: insertErr.message }, 500)
  }

  return jsonResponse({ ok: true, kind: "feedback_resolved", messageId: providerId })
}
