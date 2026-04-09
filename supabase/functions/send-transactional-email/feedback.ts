/** Lightweight feedback ack / resolved templates — English only (matches welcome V1). */

export function buildFeedbackAckEmail(params: {
  unsubscribeUrl: string
}) {
  const subject = "We received your feedback"
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#111;max-width:32rem;margin:0 auto;padding:1.5rem;">
  <p><a href="${params.unsubscribeUrl}" style="color:#555;font-size:0.9rem;">Unsubscribe</a> from these notifications.</p>
  <p>Hi,</p>
  <p>Thanks for reporting an issue with exercise content. We’ve logged your feedback and will review it.</p>
  <p style="color:#555;font-size:0.9rem;">This message was sent automatically. Replies to this address are not monitored. For support, contact <strong>admin@gymlogic.me</strong>.</p>
</body>
</html>`
  return { subject, html }
}

export function buildFeedbackResolvedEmail(params: { unsubscribeUrl: string }) {
  const subject = "Your content feedback was addressed"
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#111;max-width:32rem;margin:0 auto;padding:1.5rem;">
  <p><a href="${params.unsubscribeUrl}" style="color:#555;font-size:0.9rem;">Unsubscribe</a> from these notifications.</p>
  <p>Hi,</p>
  <p>We’ve updated the exercise content you reported. Thanks for helping improve the library.</p>
  <p style="color:#555;font-size:0.9rem;">This message was sent automatically. Replies to this address are not monitored. For support, contact <strong>admin@gymlogic.me</strong>.</p>
</body>
</html>`
  return { subject, html }
}
