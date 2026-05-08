import type { AIGenerationSource } from "./aiQuota.ts"

// Type-level guard: the union must accept the embedded-agent-era sources
// added by Phase B (T116). Type-check failure here means the migration's
// CHECK constraint and the TS contract have drifted.
Deno.test("AIGenerationSource union accepts all four sources (program, workout, embedded_chat, embedded_draft)", () => {
  const sources: AIGenerationSource[] = [
    "program",
    "workout",
    "embedded_chat",
    "embedded_draft",
  ]
  if (new Set(sources).size !== sources.length) {
    throw new Error("duplicate sources in union sample")
  }
})
