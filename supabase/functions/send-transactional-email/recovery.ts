/**
 * Session-recovery notice — subject, preview and the seed HTML for the Resend
 * template. One-off admin mail to the users whose sessions were hidden by the
 * #568 orphan bug (see the #568 fix and ADR 0024).
 *
 * The copy is English, personal, and says plainly that it was written by the
 * assistant. Badges are inlined per recipient through `ACHIEVEMENTS`.
 *
 * Text variables are HTML-escaped here so the template can interpolate them raw
 * (`{{{SESSION_LABEL}}}`); only `ACHIEVEMENTS` is deliberately pre-rendered HTML.
 */

export const RECOVERY_SUBJECT = "A session of yours went missing. It’s back."

export const RECOVERY_PREVIEW =
  "A session of yours was hidden. It’s back, with the achievements it should have earned."

export const DEFAULT_RECOVERY_TEMPLATE_ID = "session-recovery-notice"

export const RECOVERY_URL_FALLBACKS = {
  APP_URL: "https://gymlogic.me",
} as const

export type RecoveryVariables = {
  SESSION_DATE: string
  SESSION_LABEL: string
  SET_COUNT: string
  DURATION: string
  /** Pre-rendered, escaped HTML list of badges (see `renderAchievements`). */
  ACHIEVEMENTS: string
  APP_URL: string
}

export type RecoveryBadge = {
  iconUrl: string
  track: string
  rank: string
  title: string
  threshold: string
}

export type RecoverySendPayload = {
  subject: string
  template: { id: string; variables: RecoveryVariables }
}

const BUTTON =
  "display:inline-block;background-color:#00c9a7;color:#000000;text-decoration:none;font-weight:500;font-size:14px;line-height:1.4;padding:12px 20px;border-radius:8px;"

const BODY =
  "font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1a1a22;line-height:1.55;font-size:16px;"

const MUTED = "color:#666666;font-size:14px;line-height:1.5;"

const LINK = "color:#00c9a7;text-decoration:underline;"

function httpsUrl(raw: string | undefined, fallback: string): string {
  const candidate = raw?.trim() || fallback
  return candidate.startsWith("https://") ? candidate : fallback
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

/**
 * Render the badge list inlined by the sender. Every field is escaped: the
 * catalog text is ours but the label a recipient typed is not ours to trust.
 */
export function renderAchievements(badges: RecoveryBadge[]): string {
  return badges
    .map(
      (b) =>
        `<p style="margin:0 0 10px;">` +
        `<img src="${escapeHtml(b.iconUrl)}" width="40" height="40" alt="" ` +
        `style="vertical-align:middle;border-radius:8px;margin-right:10px;" />` +
        `<span style="vertical-align:middle;"><strong>${escapeHtml(b.track)}, ${escapeHtml(b.rank)}</strong> — ${escapeHtml(b.title)} (${escapeHtml(b.threshold)})</span>` +
        `</p>`,
    )
    .join("")
}

export function buildRecoverySend(params: {
  templateId?: string
  appUrl?: string
  sessionDate: string
  sessionLabel: string
  setCount: number
  duration: string
  badges: RecoveryBadge[]
}): RecoverySendPayload {
  return {
    subject: RECOVERY_SUBJECT,
    template: {
      id: params.templateId?.trim() || DEFAULT_RECOVERY_TEMPLATE_ID,
      variables: {
        SESSION_DATE: escapeHtml(params.sessionDate),
        SESSION_LABEL: escapeHtml(params.sessionLabel),
        SET_COUNT: String(params.setCount),
        DURATION: escapeHtml(params.duration),
        ACHIEVEMENTS: renderAchievements(params.badges),
        APP_URL: httpsUrl(params.appUrl, RECOVERY_URL_FALLBACKS.APP_URL),
      },
    },
  }
}

export const RECOVERY_TEMPLATE_VARIABLES: {
  key: keyof RecoveryVariables
  type: "string"
  fallbackValue: string
}[] = [
  { key: "SESSION_DATE", type: "string", fallbackValue: "a recent day" },
  { key: "SESSION_LABEL", type: "string", fallbackValue: "Workout" },
  { key: "SET_COUNT", type: "string", fallbackValue: "0" },
  { key: "DURATION", type: "string", fallbackValue: "a session" },
  { key: "ACHIEVEMENTS", type: "string", fallbackValue: "" },
  { key: "APP_URL", type: "string", fallbackValue: RECOVERY_URL_FALLBACKS.APP_URL },
]

/**
 * Seed HTML for `resend.templates.create`. After publish, Resend is the live
 * source; this string is how the template is recreated or updated.
 */
export const RECOVERY_TEMPLATE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${RECOVERY_SUBJECT}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${RECOVERY_PREVIEW}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="512" cellpadding="0" cellspacing="0" style="max-width:32rem;width:100%;background-color:#ffffff;border-radius:12px;">
          <tr>
            <td style="padding:32px 28px 28px;${BODY}">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="height:3px;width:48px;background-color:#00c9a7;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
              <p style="margin:16px 0 28px;font-size:20px;font-weight:600;letter-spacing:-0.02em;color:#1a1a22;">GymLogic</p>

              <p style="margin:0 0 12px;">I’m GymLogic’s assistant, writing to you about something on our side.</p>
              <p style="margin:0 0 12px;">On <strong>{{{SESSION_DATE}}}</strong> you logged a full session: “{{{SESSION_LABEL}}}”, {{{SET_COUNT}}} sets over {{{DURATION}}}. The app saved every set, but it never marked the session as finished. And a session without that mark was hidden from your history, so it looked like you never trained that day.</p>
              <p style="margin:0 0 12px;">That was a bug, not you. It’s fixed, and the session is back in Activity exactly as you logged it. Your sets, weights and reps were never touched.</p>
              <p style="margin:0 0 12px;">One more thing came unstuck with it. That session also pushed you past an achievement that never got credited:</p>
              {{{ACHIEVEMENTS}}}
              <p style="margin:12px 0;">It’s on your profile now.</p>
              <p style="margin:0 0 12px;">What it means for you: nothing to do. Your data was never at risk; the only thing wrong was that we weren’t showing it.</p>
              <p style="margin:0 0 20px;">Thanks for trusting GymLogic with your training.</p>
              <p style="margin:0 0 12px;">GymLogic is still young, and the people training on it now are the ones shaping where it goes. If something’s off, or you’d do it differently, reply to this email. It reaches a person at <a href="mailto:admin@gymlogic.me" style="${LINK}">admin@gymlogic.me</a>.</p>
              <p style="margin:20px 0 0;${MUTED}">— GymLogic’s assistant<br />I’m not a person. But write back, and a person reads it at <a href="mailto:admin@gymlogic.me" style="color:#666666;text-decoration:underline;">admin@gymlogic.me</a>.</p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 16px;">
                <tr>
                  <td style="border-top:1px solid #e8e8ec;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <p style="margin:0 0 8px;${MUTED}">P.S. The technical version, if you want it: a session is written in two steps, the sets as you log them, then a “Finish” when you tap Finish. If that finish never landed, the row stayed open and a history filter hid it. We now close any such session on the next app open, using your last logged set as the end time, and stop hiding an unfinished one.</p>
              <p style="margin:0 0 8px;${MUTED}">Fixed in <a href="https://github.com/PierreTsia/workout-app/commit/65da27ec4331ddd0bd0966b2440cccf4d49b1ebd" style="color:#666666;text-decoration:underline;">commit 65da27e</a> (<a href="https://github.com/PierreTsia/workout-app/pull/570" style="color:#666666;text-decoration:underline;">PR #570</a>), with the decision in <a href="https://github.com/PierreTsia/workout-app/blob/main/docs/adr/0024-session-orphan-self-heal.md" style="color:#666666;text-decoration:underline;">ADR 0024</a> and the <a href="https://github.com/PierreTsia/workout-app/blob/main/docs/Tech_Plan_%E2%80%94_Session_Orphan_Self-Heal_%23568.md" style="color:#666666;text-decoration:underline;">Tech Plan</a>. The recovered sessions’ records and achievements were re-derived in <a href="https://github.com/PierreTsia/workout-app/pull/572" style="color:#666666;text-decoration:underline;">PR #572</a>, and the source of the bug is being closed next in <a href="https://github.com/PierreTsia/workout-app/issues/571" style="color:#666666;text-decoration:underline;">#571</a>.</p>
              <p style="margin:16px 0 0;">&nbsp;</p>
              <p style="margin:0;"><a href="{{{APP_URL}}}" style="${BUTTON}">Open the app</a></p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0 16px;">
                <tr>
                  <td style="border-top:1px solid #e8e8ec;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <p style="margin:0;${MUTED}">This note was written by GymLogic’s assistant. · <a href="mailto:admin@gymlogic.me" style="color:#666666;text-decoration:underline;">admin@gymlogic.me</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
