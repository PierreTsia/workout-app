import {
  assertEquals,
  assertInstanceOf,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts"
import { callGroqChat } from "./groqClient.ts"
import { ProviderError } from "./providerError.ts"

// #405 — OpenAI-compatible Groq core. Tests drive the contract through the
// public `callGroqChat` surface with an injected `fetchImpl` (no network):
// what it returns, what it throws (typed by the shared taxonomy), and the
// request shape Groq requires.

function okResponse(content: string): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  )
}

Deno.test("callGroqChat: returns the assistant message content on 200", async () => {
  const fetchImpl = (() => Promise.resolve(okResponse("hello from groq"))) as typeof fetch

  const text = await callGroqChat(
    { systemPrompt: "you are helpful", messages: [{ role: "user", content: "hi" }] },
    { apiKey: "test-key", fetchImpl },
  )

  assertEquals(text, "hello from groq")
})

function errorResponse(status: number, body = "upstream"): Response {
  return new Response(body, { status })
}

Deno.test("callGroqChat: 503 throws a ProviderError(provider_unavailable) with upstreamStatus", async () => {
  const fetchImpl = (() => Promise.resolve(errorResponse(503))) as typeof fetch

  const err = await assertRejects(() =>
    callGroqChat(
      { systemPrompt: "s", messages: [{ role: "user", content: "hi" }] },
      { apiKey: "k", fetchImpl },
    ),
  )

  assertInstanceOf(err, ProviderError)
  assertEquals(err.kind, "provider_unavailable")
  assertEquals(err.upstreamStatus, 503)
})

Deno.test("callGroqChat: 200 with no content throws ProviderError(empty_response)", async () => {
  const fetchImpl = (() =>
    Promise.resolve(
      new Response(JSON.stringify({ choices: [{ message: {} }] }), { status: 200 }),
    )) as typeof fetch

  const err = await assertRejects(() =>
    callGroqChat(
      { systemPrompt: "s", messages: [{ role: "user", content: "hi" }] },
      { apiKey: "k", fetchImpl },
    ),
  )

  assertInstanceOf(err, ProviderError)
  assertEquals(err.kind, "empty_response")
})

Deno.test("callGroqChat: responseSchema → strict json_schema response_format, model, auth, system-first", async () => {
  let captured: { url: string; init: RequestInit } | undefined
  const fetchImpl = ((url: string, init: RequestInit) => {
    captured = { url, init }
    return Promise.resolve(okResponse('{"ok":true}'))
  }) as unknown as typeof fetch

  const schema = { name: "workout", schema: { type: "object", properties: {} } }
  await callGroqChat(
    {
      systemPrompt: "you are a coach",
      messages: [{ role: "user", content: "make me a workout" }],
      responseSchema: schema,
    },
    { apiKey: "secret-key", fetchImpl },
  )

  const headers = captured!.init.headers as Record<string, string>
  assertEquals(headers.Authorization, "Bearer secret-key")

  const body = JSON.parse(captured!.init.body as string)
  assertEquals(body.model, "llama-3.3-70b-versatile")
  assertEquals(body.messages[0], { role: "system", content: "you are a coach" })
  assertEquals(body.messages[1], { role: "user", content: "make me a workout" })
  assertEquals(body.response_format, {
    type: "json_schema",
    json_schema: { name: "workout", schema: schema.schema, strict: true },
  })
})

Deno.test("callGroqChat: no responseSchema → no response_format (free-form chat)", async () => {
  let captured: RequestInit | undefined
  const fetchImpl = ((_url: string, init: RequestInit) => {
    captured = init
    return Promise.resolve(okResponse("free text"))
  }) as unknown as typeof fetch

  await callGroqChat(
    { systemPrompt: "s", messages: [{ role: "user", content: "hi" }] },
    { apiKey: "k", fetchImpl },
  )

  const body = JSON.parse(captured!.body as string)
  assertEquals(body.response_format, undefined)
})

Deno.test("callGroqChat: empty systemPrompt → no system message (single-user-turn JSON calls)", async () => {
  let body: { messages: { role: string; content: string }[] } | undefined
  const fetchImpl = ((_url: string, init: RequestInit) => {
    body = JSON.parse(init.body as string)
    return Promise.resolve(okResponse('{"ok":true}'))
  }) as unknown as typeof fetch

  await callGroqChat(
    { systemPrompt: "", messages: [{ role: "user", content: "the whole prompt" }] },
    { apiKey: "k", fetchImpl },
  )

  assertEquals(body!.messages, [{ role: "user", content: "the whole prompt" }])
})

Deno.test("callGroqChat: an aborted fetch surfaces as ProviderError(timeout)", async () => {
  const fetchImpl = (() =>
    Promise.reject(new DOMException("The signal was aborted", "AbortError"))) as typeof fetch

  const err = await assertRejects(() =>
    callGroqChat(
      { systemPrompt: "s", messages: [{ role: "user", content: "hi" }] },
      { apiKey: "k", fetchImpl },
    ),
  )

  assertInstanceOf(err, ProviderError)
  assertEquals(err.kind, "timeout")
})

Deno.test("callGroqChat: passes an abort signal to fetch (bounded by its own budget)", async () => {
  let signal: AbortSignal | undefined
  const fetchImpl = ((_url: string, init: RequestInit) => {
    signal = init.signal ?? undefined
    return Promise.resolve(okResponse("ok"))
  }) as unknown as typeof fetch

  await callGroqChat(
    { systemPrompt: "s", messages: [{ role: "user", content: "hi" }] },
    { apiKey: "k", fetchImpl },
  )

  assertInstanceOf(signal, AbortSignal)
})
