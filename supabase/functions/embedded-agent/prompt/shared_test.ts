import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { parseReadySignalCore } from "./shared.ts"

// `parseReadySignalCore` is the bare regex+strip primitive shared by both
// per-flow validators (T132, #343). The semantic field validation lives in
// `onboarding.ts` / `additional-program.ts` — these tests cover ONLY the
// "did we find a signal line and what's the raw payload?" question.

Deno.test("parseReadySignalCore returns found:false and untouched content when no signal line is present", () => {
  const result = parseReadySignalCore("Tell me more about your back, please.")
  assertEquals(result.found, false)
  assertEquals(result.cleanContent, "Tell me more about your back, please.")
  assertEquals(result.rawPayload, undefined)
})

Deno.test("parseReadySignalCore extracts rawPayload and strips the signal line from cleanContent", () => {
  const content =
    `Sounds good — I have what I need to draft a plan.\n` +
    `READY_FOR_PROGRAM_DRAFT: {"v":1,"ready":true,"motivation":"plateau"}`

  const result = parseReadySignalCore(content)

  assertEquals(result.found, true)
  assertEquals(result.rawPayload, `{"v":1,"ready":true,"motivation":"plateau"}`)
  assertEquals(result.cleanContent, "Sounds good — I have what I need to draft a plan.")
})

Deno.test("parseReadySignalCore returns found:true even when payload is malformed JSON (caller decides)", () => {
  // The core primitive is layered: it tells you "the signal line is here,
  // here's the raw text". The per-flow validator does the JSON.parse and
  // decides whether malformed → soft no-signal vs hard rejection.
  const content =
    `OK, ready to go.\n` +
    `READY_FOR_PROGRAM_DRAFT: {this is not json}`

  const result = parseReadySignalCore(content)

  assertEquals(result.found, true)
  assertEquals(result.rawPayload, "{this is not json}")
  assertEquals(result.cleanContent, "OK, ready to go.")
})

Deno.test("parseReadySignalCore trims trailing whitespace after stripping the signal", () => {
  const content =
    `Got it.\n` +
    `READY_FOR_PROGRAM_DRAFT: {"v":1,"ready":true,"motivation":"variety"}` +
    `\n\n  `

  const result = parseReadySignalCore(content)

  assertEquals(result.found, true)
  assertEquals(result.cleanContent, "Got it.")
})

Deno.test("parseReadySignalCore handles empty content", () => {
  const result = parseReadySignalCore("")
  assertEquals(result.found, false)
  assertEquals(result.cleanContent, "")
})
