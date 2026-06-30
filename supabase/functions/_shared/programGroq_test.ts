import {
  assertEquals,
  assertInstanceOf,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts"
import { callGroqProgram } from "./programGroq.ts"
import { ProviderError } from "./providerError.ts"

// #405 — Groq program adapter. Same `(prompt) => GenerateProgramResponse`
// shape as `callGeminiProgram`, so it drops into the program-draft seam.
// Tests pin the parsed shape and the json_schema request through the public
// adapter; the downstream `validateProgram` repair net is exercised
// elsewhere and stays provider-agnostic.

function groqJsonResponse(payload: unknown): Response {
  return new Response(
    JSON.stringify({
      choices: [
        { message: { role: "assistant", content: JSON.stringify(payload) } },
      ],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  )
}

const VALID_PROGRAM = {
  rationale: "Upper/lower split for hypertrophy",
  days: [
    { label: "Upper A", muscle_focus: "chest, back", exercise_ids: ["ex-1", "ex-2"] },
    { label: "Lower A", muscle_focus: "quads, hamstrings", exercise_ids: ["ex-3"] },
  ],
}

Deno.test("callGroqProgram: parses a valid program JSON into GenerateProgramResponse", async () => {
  const fetchImpl = (() => Promise.resolve(groqJsonResponse(VALID_PROGRAM))) as typeof fetch

  const program = await callGroqProgram("build a 2-day program", { apiKey: "k", fetchImpl })

  assertEquals(program, VALID_PROGRAM)
})

Deno.test("callGroqProgram: requests strict json_schema with the program shape", async () => {
  let body: { response_format?: { json_schema?: { schema?: { required?: string[] } } } } | undefined
  const fetchImpl = ((_url: string, init: RequestInit) => {
    body = JSON.parse(init.body as string)
    return Promise.resolve(groqJsonResponse(VALID_PROGRAM))
  }) as unknown as typeof fetch

  await callGroqProgram("prompt", { apiKey: "k", fetchImpl })

  assertEquals(body!.response_format!.json_schema!.schema!.required, ["rationale", "days"])
})

Deno.test("callGroqProgram: unparseable content throws ProviderError(empty_response)", async () => {
  const fetchImpl = (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "not json at all" } }] }),
        { status: 200 },
      ),
    )) as typeof fetch

  const err = await assertRejects(() => callGroqProgram("p", { apiKey: "k", fetchImpl }))

  assertInstanceOf(err, ProviderError)
  assertEquals(err.kind, "empty_response")
})
