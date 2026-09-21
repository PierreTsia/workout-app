import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import {
  DEFAULT_WELCOME_TEMPLATE_ID,
  WELCOME_PREVIEW,
  WELCOME_SUBJECT,
  WELCOME_TEMPLATE_HTML,
  WELCOME_URL_FALLBACKS,
  resolveWelcomeSend,
} from "./welcome.ts"

Deno.test("resolveWelcomeSend uses the welcome alias and production URL fallbacks", () => {
  const send = resolveWelcomeSend({})
  assertEquals(send.subject, WELCOME_SUBJECT)
  assertEquals(send.template.id, DEFAULT_WELCOME_TEMPLATE_ID)
  assertEquals(send.template.variables, { ...WELCOME_URL_FALLBACKS })
})

Deno.test("resolveWelcomeSend prefers a trimmed template id and https overrides", () => {
  const send = resolveWelcomeSend({
    templateId: "  tpl_abc  ",
    appUrl: "https://staging.gymlogic.me/",
    tourUrl: "https://docs.gymlogic.me/tour",
    connectUrl: "https://docs.gymlogic.me/connect/claude",
  })
  assertEquals(send.template.id, "tpl_abc")
  assertEquals(send.template.variables.APP_URL, "https://staging.gymlogic.me/")
  assertEquals(send.template.variables.TOUR_URL, WELCOME_URL_FALLBACKS.TOUR_URL)
  assertEquals(send.template.variables.CONNECT_URL, WELCOME_URL_FALLBACKS.CONNECT_URL)
})

Deno.test("resolveWelcomeSend rejects non-https overrides instead of interpolating them", () => {
  const send = resolveWelcomeSend({
    appUrl: "javascript:alert(1)",
    tourUrl: "http://insecure.example",
    connectUrl: "ftp://nope",
  })
  assertEquals(send.template.variables, { ...WELCOME_URL_FALLBACKS })
})

Deno.test("welcome template HTML is the locked Welcome Email (no images)", () => {
  const html = WELCOME_TEMPLATE_HTML
  assertEquals(html.includes("<img"), false)
  assertEquals(html.includes(WELCOME_PREVIEW), true)
  assertEquals(html.includes('id="francais"'), true)
  assertEquals(html.includes("Version française"), true)
  assertEquals(html.includes("{{{APP_URL}}}"), true)
  assertEquals(html.includes("{{{TOUR_URL}}}"), true)
  assertEquals(html.includes("{{{CONNECT_URL}}}"), true)
  assertEquals(html.includes("Open the app"), true)
  assertEquals(html.includes("Ouvre l’app"), true)
  assertEquals(html.includes("Quick Workout"), true)
  assertEquals(html.includes("RIR (reps in reserve)"), true)
  assertEquals(html.includes("RIR (répétitions en réserve)"), true)
  assertEquals(html.includes("progressive overload"), true)
  assertEquals(html.includes("surcharge progressive"), true)
  assertEquals(
    html.includes("the connector that lets an AI agent talk to GymLogic"),
    true,
  )
  assertEquals(
    html.includes("le connecteur qui permet à un agent IA de parler à GymLogic"),
    true,
  )
  assertEquals(html.includes("the long version / la version longue"), true)
  assertEquals(html.includes("admin@gymlogic.me"), true)
})
