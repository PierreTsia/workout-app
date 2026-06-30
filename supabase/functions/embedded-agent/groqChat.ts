// #405 — Groq chat adapter for the Embedded Agent. Free-form turn (no
// response_schema), same `(ChatModelInput) => ChatModelOutput` shape as
// `callChatGemini`, so `withFallback(callChatGemini, callChatGroq, …)`
// composes at the seam without touching the handler. The thread roles
// ("user" | "assistant") already match OpenAI's, so the mapping is just
// dropping the `ts` field.

import type { ChatModelInput, ChatModelOutput } from "./handler.ts"
import { GROQ } from "../_shared/aiProviders.ts"
import { callGroqChat, type CallGroqChatOptions } from "../_shared/groqClient.ts"

export async function callChatGroq(
  input: ChatModelInput,
  opts: CallGroqChatOptions = {},
): Promise<ChatModelOutput> {
  const apiKey = opts.apiKey ?? Deno.env.get(GROQ.apiKeyEnv)

  const content = await callGroqChat(
    {
      systemPrompt: input.systemPrompt,
      messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: 0.7,
      maxTokens: 1024,
    },
    { ...opts, apiKey },
  )

  return { content: content.trim() }
}
