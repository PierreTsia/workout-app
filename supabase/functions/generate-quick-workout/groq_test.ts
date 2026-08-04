import {
  assertEquals,
  assertInstanceOf,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts"
import { callGroqWorkout } from "./groq.ts"
import { ProviderError } from "../_shared/providerError.ts"

// #405 — Groq quick-workout adapter. Same `(prompt) => { exerciseIds,
// rationale }` shape as the Gemini `callGemini`, so it composes at the
// quick-workout seam. Tests pin the parsed shape, the json_schema request,
// and the typed empty_response on garbage — through the public adapter.

function groqJsonResponse(payload: unknown): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { role: "assistant", content: JSON.stringify(payload) } }],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  )
}

Deno.test("callGroqWorkout: parses a valid workout JSON and trims the rationale", async () => {
  const fetchImpl = (() =>
    Promise.resolve(
      groqJsonResponse({ rationale: "  full-body push  ", exerciseIds: ["ex-1", "ex-2"] }),
    )) as typeof fetch

  const out = await callGroqWorkout("give me a push workout", { apiKey: "k", fetchImpl })

  assertEquals(out, { rationale: "full-body push", exerciseIds: ["ex-1", "ex-2"] })
})

Deno.test("callGroqWorkout: requests strict json_schema with the workout shape", async () => {
  let body:
    | {
        response_format?: {
          json_schema?: {
            schema?: {
              required?: string[]
              properties?: { exercises?: unknown; exerciseIds?: unknown }
            }
          }
        }
      }
    | undefined
  const fetchImpl = ((_url: string, init: RequestInit) => {
    body = JSON.parse(init.body as string)
    // Non-empty exerciseIds — parse rejects empty day-items after T170.
    return Promise.resolve(groqJsonResponse({ rationale: "r", exerciseIds: ["ex-1"] }))
  }) as unknown as typeof fetch

  await callGroqWorkout("prompt", { apiKey: "k", fetchImpl })

  const schema = body!.response_format!.json_schema!.schema!
  // T170: day-items live in `exercises`; `exerciseIds` is optional legacy.
  assertEquals(schema.required, ["rationale"])
  assertEquals(typeof schema.properties?.exercises, "object")
  assertEquals(typeof schema.properties?.exerciseIds, "object")
})

Deno.test("callGroqWorkout: unparseable content throws ProviderError(empty_response)", async () => {
  const fetchImpl = (() =>
    Promise.resolve(
      new Response(JSON.stringify({ choices: [{ message: { content: "nope" } }] }), {
        status: 200,
      }),
    )) as typeof fetch

  const err = await assertRejects(() => callGroqWorkout("p", { apiKey: "k", fetchImpl }))

  assertInstanceOf(err, ProviderError)
  assertEquals(err.kind, "empty_response")
})
