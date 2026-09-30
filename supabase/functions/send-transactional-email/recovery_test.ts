import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts"
import {
  DEFAULT_RECOVERY_TEMPLATE_ID,
  RECOVERY_SUBJECT,
  RECOVERY_TEMPLATE_HTML,
  RECOVERY_URL_FALLBACKS,
  buildRecoverySend,
  renderAchievements,
  type RecoveryBadge,
} from "./recovery.ts"

const badge = (over: Partial<RecoveryBadge> = {}): RecoveryBadge => ({
  iconUrl: "https://cdn.example/exercise_variety_silver.webp",
  track: "Variety",
  rank: "silver",
  title: "The Explorer",
  threshold: "15 different exercises",
  ...over,
})

const args = {
  sessionDate: "29 September",
  sessionLabel: "Tag C – Ganzkörper-Kombi + Beine",
  setCount: 15,
  duration: "about 80 minutes",
  badges: [badge()],
}

Deno.test("buildRecoverySend uses the recovery alias, subject and URL fallback", () => {
  const send = buildRecoverySend(args)
  assertEquals(send.subject, RECOVERY_SUBJECT)
  assertEquals(send.template.id, DEFAULT_RECOVERY_TEMPLATE_ID)
  assertEquals(send.template.variables.APP_URL, RECOVERY_URL_FALLBACKS.APP_URL)
  assertEquals(send.template.variables.SET_COUNT, "15")
})

Deno.test("buildRecoverySend prefers a trimmed template id and https override", () => {
  const send = buildRecoverySend({
    ...args,
    templateId: "  tpl_abc  ",
    appUrl: "https://staging.gymlogic.me/",
  })
  assertEquals(send.template.id, "tpl_abc")
  assertEquals(send.template.variables.APP_URL, "https://staging.gymlogic.me/")
})

Deno.test("buildRecoverySend rejects a non-https appUrl instead of interpolating it", () => {
  const send = buildRecoverySend({ ...args, appUrl: "javascript:alert(1)" })
  assertEquals(send.template.variables.APP_URL, RECOVERY_URL_FALLBACKS.APP_URL)
})

Deno.test("user-authored text is HTML-escaped, not passed through raw", () => {
  const send = buildRecoverySend({
    ...args,
    sessionLabel: "<b>x</b> & \"boom\"",
    sessionDate: "<i>today</i>",
  })
  assertEquals(send.template.variables.SESSION_LABEL, "&lt;b&gt;x&lt;/b&gt; &amp; &quot;boom&quot;")
  assertEquals(send.template.variables.SESSION_DATE, "&lt;i&gt;today&lt;/i&gt;")
})

Deno.test("renderAchievements escapes catalog text and keeps the icon", () => {
  const html = renderAchievements([badge({ title: "Tom & <Jerry>", rank: "silver" })])
  assertStringIncludes(html, 'src="https://cdn.example/exercise_variety_silver.webp"')
  assertStringIncludes(html, "Tom &amp; &lt;Jerry&gt;")
  assertStringIncludes(html, "<strong>Variety, silver</strong>")
})

Deno.test("recovery template seed interpolates ACHIEVEMENTS raw and the text vars", () => {
  const html = RECOVERY_TEMPLATE_HTML
  assertStringIncludes(html, "{{{ACHIEVEMENTS}}}")
  assertStringIncludes(html, "{{{SESSION_LABEL}}}")
  // The disclosure must not claim the note was sent automatically.
  assertEquals(html.includes("sent automatically"), false)
})
