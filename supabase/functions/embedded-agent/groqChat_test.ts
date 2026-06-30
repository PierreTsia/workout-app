import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { callChatGroq } from "./groqChat.ts"
import type { ChatModelInput } from "./handler.ts"

// #405 — Groq chat adapter. Same `(ChatModelInput) => ChatModelOutput`
// signature as `callChatGemini` so it drops into the seam unchanged. Tests
// pin the mapping (thread roles → OpenAI roles, system prompt) and that it
// returns the model text — through the public adapter, fetch injected.

function okResponse(content: string): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { role: "assistant", content } }] }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  )
}

function makeInput(overrides: Partial<ChatModelInput> = {}): ChatModelInput {
  return {
    systemPrompt: "you are a helpful coach",
    messages: [{ role: "user", content: "hi", ts: "2026-05-20T13:00:00.000Z" }],
    ...overrides,
  }
}

Deno.test("callChatGroq: returns the model text as ChatModelOutput", async () => {
  const fetchImpl = (() => Promise.resolve(okResponse("hey there"))) as typeof fetch

  const out = await callChatGroq(makeInput(), { apiKey: "k", fetchImpl })

  assertEquals(out, { content: "hey there" })
})

Deno.test("callChatGroq: forwards system prompt + full transcript with thread roles preserved", async () => {
  let body: { messages: { role: string; content: string }[] } | undefined
  const fetchImpl = ((_url: string, init: RequestInit) => {
    body = JSON.parse(init.body as string)
    return Promise.resolve(okResponse("ok"))
  }) as unknown as typeof fetch

  await callChatGroq(
    makeInput({
      systemPrompt: "be concise",
      messages: [
        { role: "user", content: "hi", ts: "t1" },
        { role: "assistant", content: "hello", ts: "t2" },
        { role: "user", content: "build me a plan", ts: "t3" },
      ],
    }),
    { apiKey: "k", fetchImpl },
  )

  assertEquals(body!.messages, [
    { role: "system", content: "be concise" },
    { role: "user", content: "hi" },
    { role: "assistant", content: "hello" },
    { role: "user", content: "build me a plan" },
  ])
})
