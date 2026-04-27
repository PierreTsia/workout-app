import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import { personalAccessTokensQueryKey } from "@/hooks/usePersonalAccessTokens"
import type {
  CreatePATInput,
  CreatePATResponse,
} from "@/types/personalAccessToken"

/**
 * Thrown when the user already owns a PAT with the same name. UI should map
 * this to a field-level error on `name`, not a global toast.
 */
export class DuplicateNameError extends Error {
  constructor() {
    super("duplicate_name")
    this.name = "DuplicateNameError"
  }
}

/**
 * Thrown when the user has hit the 10-PAT-per-user quota (see PAT_QUOTA in
 * supabase/functions/create-pat/createPatLogic.ts). UI should disable the
 * "create" CTA proactively, but this guards the race where two creates land
 * concurrently.
 */
export class QuotaExceededError extends Error {
  constructor() {
    super("quota_exceeded")
    this.name = "QuotaExceededError"
  }
}

/**
 * Thrown when the request was rejected by the anti-escalation `aal != 'pat'`
 * claim check, i.e. the caller authenticated with a PAT-derived JWT and tried
 * to mint another PAT. By design — see Tech Plan, "Component Responsibilities,
 * create-pat".
 */
export class PATForbiddenError extends Error {
  constructor() {
    super("pat_derived_jwt")
    this.name = "PATForbiddenError"
  }
}

/**
 * Pull the machine-readable error code from a `create-pat` error response.
 * The Edge Function returns `{ error: <human message>, code: "duplicate_name"
 * | "quota_exceeded" | ... }` — we route on `code` only. The `error` field is
 * for display copy (which we override with our own i18n strings anyway).
 */
async function readErrorBodyCode(error: unknown): Promise<string | null> {
  const ctx = (error as { context?: unknown } | null)?.context as
    | Response
    | undefined
  if (!ctx || typeof ctx.clone !== "function") return null
  try {
    const body = (await ctx.clone().json()) as {
      code?: unknown
      error?: unknown
    }
    return typeof body.code === "string" ? body.code : null
  } catch {
    return null
  }
}

export function useCreatePAT() {
  const user = useAtomValue(authAtom)
  const queryClient = useQueryClient()

  return useMutation<CreatePATResponse, Error, CreatePATInput>({
    mutationFn: async (input) => {
      const { data, error } = await supabase.functions.invoke("create-pat", {
        method: "POST",
        body: input,
      })

      if (error) {
        const ctx = (error as { context?: unknown }).context as
          | Response
          | undefined
        const status = ctx?.status
        const code = await readErrorBodyCode(error)

        if (status === 409 && code === "duplicate_name") {
          throw new DuplicateNameError()
        }
        if (status === 409 && code === "quota_exceeded") {
          throw new QuotaExceededError()
        }
        if (status === 403) {
          throw new PATForbiddenError()
        }
        throw error
      }

      if (!data) {
        throw new Error("create-pat returned an empty response")
      }
      return data as CreatePATResponse
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: personalAccessTokensQueryKey(user?.id),
      })
    },
    // The duplicate-name path is handled inline by the dialog (field-level
    // error), so we mute the global toast for it. Other errors fall through
    // to the global MutationCache handler.
    meta: { suppressGlobalErrorToast: true },
  })
}
