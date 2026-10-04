import { previewSecret, verifyPreviewToken } from "../lib/previewToken.ts"
import { updateProgram } from "./updateProgram.ts"
import type { ToolDefinition } from "./registry.ts"

/**
 * `apply_program_patch` — the **App-Only Tool** (ADR 0028) a Decision Card calls through
 * the host (`tools/call`) when the athlete clicks Apply. It never appears in the model's
 * tool list (`_meta.ui.visibility: ["app"]`) and refuses to run without a valid
 * **Preview Token**, so the model cannot self-apply even on a non-compliant host.
 *
 * It reuses `update_program`'s validation / diff / apply wholesale — no second write path.
 */
export const applyProgramPatch: ToolDefinition = {
  name: "apply_program_patch",
  description:
    "Apply a program change the athlete previewed and approved in the conversation card. Requires the preview token issued by update_program with dry_run:true. Not callable by the model.",
  annotations: {
    title: "Apply program change",
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
  },
  _meta: { ui: { visibility: ["app"] } },
  inputSchema: {
    type: "object",
    properties: {
      preview_token: {
        type: "string",
        description: "The preview token returned by `update_program` with `dry_run: true`.",
      },
    },
    required: ["preview_token"],
  },

  async handler(args, supabase) {
    if (!supabase) {
      return {
        content: [{ type: "text", text: "Authentication required — please provide a valid Bearer token." }],
        isError: true,
      }
    }

    const secret = previewSecret()
    if (!secret) {
      return {
        content: [{ type: "text", text: "Applying is not configured on this server." }],
        isError: true,
      }
    }

    const token = typeof args.preview_token === "string" ? args.preview_token : ""
    const payload = await verifyPreviewToken(token, secret)
    if (!payload) {
      return {
        content: [{ type: "text", text: "Invalid or expired preview token — ask for a fresh preview." }],
        isError: true,
      }
    }

    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData?.user) {
      return {
        content: [{ type: "text", text: "Could not identify the authenticated user." }],
        isError: true,
      }
    }
    if (userData.user.id !== payload.u) {
      return {
        content: [{ type: "text", text: "This preview belongs to a different account." }],
        isError: true,
      }
    }

    // The click is the consent — but only for the change the athlete was shown. `confirm`
    // is the preview's own destructiveness, replayed: if the program changed since and the
    // diff became destructive, `update_program` blocks instead of deleting an unseen day.
    return updateProgram.handler(
      { ...payload.patch, dry_run: false, confirm: payload.confirm },
      supabase,
    )
  },
}
