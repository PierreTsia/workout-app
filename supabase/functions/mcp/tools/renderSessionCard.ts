import { buildSessionCardPayload, resolveCardLocale } from "../lib/sessionCard.ts"
import type { ToolDefinition } from "./registry.ts"

const URI = "ui://gymlogic/session-card"

/**
 * Show the athlete's most recent finished session as an **MCP App View** (ADR 0027).
 * Read-only: the card never writes. The payload rides `structuredContent`, which the host
 * pushes into the view; the text block is the fallback for clients that ignore `_meta`.
 */
export const renderSessionCard: ToolDefinition = {
  name: "render_session_card",
  description:
    "Show the athlete's most recent finished training session as a card in the conversation (MCP Apps). Read-only; falls back to a text summary on clients that ignore `_meta`.",
  annotations: {
    title: "Show session card",
    readOnlyHint: true,
    idempotentHint: true,
  },
  _meta: { ui: { resourceUri: URI } },
  inputSchema: {
    type: "object",
    properties: {
      locale: {
        type: "string",
        enum: ["en", "fr"],
        description:
          "Language of the card's exercise names and labels. Defaults to the athlete's app locale, then English.",
      },
    },
  },

  async handler(args, supabase) {
    if (!supabase) {
      return {
        content: [{ type: "text", text: "Authentication required — please provide a valid Bearer token." }],
        isError: true,
      }
    }

    try {
      const { data: profile } = await supabase.from("user_profiles").select("locale").maybeSingle()
      const profileLocale: unknown = profile?.locale

      const locale = resolveCardLocale(args.locale, profileLocale) ?? "en"
      const payload = await buildSessionCardPayload(supabase, locale)
      const text = payload.session
        ? `## ${payload.session.label} — ${payload.session.finishedAtLabel}\n\n` +
          `${payload.session.durationLabel} · ${payload.session.setsDone} sets · ${payload.tonnageKg} kg`
        : "No workout sessions yet. Start logging workouts in the app!"
      return {
        content: [{ type: "text", text }],
        structuredContent: payload,
      }
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error building session card: ${(error as Error).message}` }],
        isError: true,
      }
    }
  },
}
