/** Welcome Email send payload + HTML seed for the Resend Template. */

export const WELCOME_SUBJECT = "Welcome to GymLogic"

export const WELCOME_PREVIEW =
  "Programs, sessions, your own agent. · Programmes, séances, ton propre agent."

export const DEFAULT_WELCOME_TEMPLATE_ID = "welcome"

export const WELCOME_URL_FALLBACKS = {
  APP_URL: "https://gymlogic.me",
  TOUR_URL: "https://docs.gymlogic.me/tour",
  CONNECT_URL: "https://docs.gymlogic.me/connect/claude",
} as const

export type WelcomeUrlKey = keyof typeof WELCOME_URL_FALLBACKS

export type WelcomeVariables = {
  APP_URL: string
  TOUR_URL: string
  CONNECT_URL: string
}

export type WelcomeSendPayload = {
  subject: string
  template: {
    id: string
    variables: WelcomeVariables
  }
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

export function resolveWelcomeVariables(params: {
  appUrl?: string
  tourUrl?: string
  connectUrl?: string
}): WelcomeVariables {
  return {
    APP_URL: httpsUrl(params.appUrl, WELCOME_URL_FALLBACKS.APP_URL),
    TOUR_URL: httpsUrl(params.tourUrl, WELCOME_URL_FALLBACKS.TOUR_URL),
    CONNECT_URL: httpsUrl(params.connectUrl, WELCOME_URL_FALLBACKS.CONNECT_URL),
  }
}

export function resolveWelcomeSend(params: {
  templateId?: string
  appUrl?: string
  tourUrl?: string
  connectUrl?: string
}): WelcomeSendPayload {
  const id = params.templateId?.trim() || DEFAULT_WELCOME_TEMPLATE_ID
  return {
    subject: WELCOME_SUBJECT,
    template: {
      id,
      variables: resolveWelcomeVariables(params),
    },
  }
}

export const WELCOME_TEMPLATE_VARIABLES: {
  key: WelcomeUrlKey
  type: "string"
  fallbackValue: string
}[] = [
  {
    key: "APP_URL",
    type: "string",
    fallbackValue: WELCOME_URL_FALLBACKS.APP_URL,
  },
  {
    key: "TOUR_URL",
    type: "string",
    fallbackValue: WELCOME_URL_FALLBACKS.TOUR_URL,
  },
  {
    key: "CONNECT_URL",
    type: "string",
    fallbackValue: WELCOME_URL_FALLBACKS.CONNECT_URL,
  },
]

/**
 * Seed HTML for `resend.templates.create`. After publish, Resend is the
 * live source — this string is how we recreate or update the template.
 */
export const WELCOME_TEMPLATE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${WELCOME_SUBJECT}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${WELCOME_PREVIEW}
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

              <p style="margin:0 0 12px;"><strong>Start with a Program.</strong> The assistant can draft one, you can build it yourself, or run a Quick Workout.</p>
              <p style="margin:0 0 12px;"><strong>Train your sessions.</strong> Log your sets and your RIR (reps in reserve). The app handles progressive overload.</p>
              <p style="margin:0 0 20px;"><strong>Connect your own agent to the app.</strong> Through MCP (the connector that lets an AI agent talk to GymLogic), <a href="{{{CONNECT_URL}}}" style="${LINK}">Claude</a> — or another client — can read your history, create a Program, and adjust a Session.</p>
              <p style="margin:0 0 8px;">
                <a href="{{{APP_URL}}}" style="${BUTTON}">Open the app</a>
              </p>
              <p style="margin:20px 0 0;${MUTED}"><a href="#francais" style="color:#666666;text-decoration:underline;">Version française ↓</a></p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0;">
                <tr>
                  <td style="border-top:1px solid #e8e8ec;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <p id="francais" style="margin:0 0 12px;"><strong>Commence par un programme.</strong> L’assistant peut en proposer un, tu peux le construire, ou lancer un Quick Workout.</p>
              <p style="margin:0 0 12px;"><strong>Tes séances.</strong> Note tes séries et ton RIR (répétitions en réserve). L’app gère la surcharge progressive.</p>
              <p style="margin:0 0 20px;"><strong>Connecte ton propre agent à l’app.</strong> Via MCP (le connecteur qui permet à un agent IA de parler à GymLogic), <a href="{{{CONNECT_URL}}}" style="${LINK}">Claude</a> — ou un autre client — peut lire ton historique, créer un programme, et ajuster une séance.</p>
              <p style="margin:0;">
                <a href="{{{APP_URL}}}" style="${BUTTON}">Ouvre l’app</a>
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0 16px;">
                <tr>
                  <td style="border-top:1px solid #e8e8ec;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <p style="margin:0 0 8px;${MUTED}">
                <a href="{{{TOUR_URL}}}" style="color:#666666;text-decoration:underline;">the long version / la version longue</a>
              </p>
              <p style="margin:0 0 8px;${MUTED}">This was sent automatically. Replies aren’t monitored. · Envoi automatique, réponses non lues.</p>
              <p style="margin:0;${MUTED}"><a href="mailto:admin@gymlogic.me" style="color:#666666;text-decoration:underline;">admin@gymlogic.me</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
