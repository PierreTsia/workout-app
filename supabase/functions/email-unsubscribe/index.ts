import { corsHeaders } from "../_shared/cors.ts"
import { createServiceClient } from "../_shared/supabase.ts"
import { unsubscribeSecret, verifyUnsubscribeToken } from "../_shared/unsubscribeToken.ts"

function htmlPage(title: string, body: string, status = 200) {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="font-family:system-ui,sans-serif;max-width:28rem;margin:2rem auto;padding:0 1rem;line-height:1.5;color:#111"><h1 style="font-size:1.25rem">${title}</h1><p>${body}</p></body></html>`
  return new Response(html, {
    status,
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  })
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "GET") {
    return htmlPage("Method not allowed", "Use GET with ?token=…", 405)
  }

  const url = new URL(req.url)
  const token = url.searchParams.get("token")
  if (!token?.trim()) {
    return htmlPage("Missing link", "This unsubscribe link is invalid.", 400)
  }

  const secret = unsubscribeSecret()
  if (!secret) {
    return htmlPage("Configuration error", "Please try again later.", 500)
  }

  const payload = await verifyUnsubscribeToken(token, secret)
  if (!payload) {
    return htmlPage("Link expired or invalid", "Request a new email or change preferences in the app when available.", 400)
  }

  const supabase = createServiceClient()
  const { error } = await supabase.from("user_email_preferences").upsert(
    { user_id: payload.u, feedback_notifications: false },
    { onConflict: "user_id" },
  )

  if (error) {
    console.error("email-unsubscribe upsert", error)
    return htmlPage("Something went wrong", "Please try again later.", 500)
  }

  return htmlPage(
    "Unsubscribed",
    "You will no longer receive email notifications about exercise content feedback. Account emails (e.g. welcome) are unchanged.",
    200,
  )
})
