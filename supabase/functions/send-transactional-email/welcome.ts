/** Lightweight welcome email — text-first HTML, no images (deliverability). */

const DEFAULT_APP_NAME = "GymLogic"

export function buildWelcomeEmail(params: { appName?: string }) {
  const name = params.appName?.trim() || DEFAULT_APP_NAME
  const subject = `Welcome to ${name}`
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#111;max-width:32rem;margin:0 auto;padding:1.5rem;">
  <p>Hi,</p>
  <p>Thanks for joining <strong>${escapeHtml(name)}</strong>. You can start logging workouts and building programs from the app.</p>
  <p style="color:#555;font-size:0.9rem;">This message was sent automatically from a no-reply address. Replies are not monitored.</p>
</body>
</html>`
  return { subject, html }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
