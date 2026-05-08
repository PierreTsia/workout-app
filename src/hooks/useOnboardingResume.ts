import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import { isEmbeddedAgentEnabled } from "@/lib/featureFlags"
import { useUserProfile } from "@/hooks/useUserProfile"
import type { UserProfile } from "@/types/onboarding"

// Subset of WizardStep we actually resume to. Kept narrow on purpose:
// resuming straight to a deeper step (recommendation, ai_preview, etc.)
// would skip past the user's path choice, which we don't have a server-side
// record of. Callers should treat anything beyond these as "start fresh".
export type OnboardingResumeStep =
  | "welcome"
  | "path"
  | "embedded_chat"
  | "embedded_preview"

export interface OnboardingResumeState {
  isLoading: boolean
  initialStep: OnboardingResumeStep
  profile: UserProfile | null
}

type EmbeddedThreadStatus = "open" | "preview_ready" | null

const RESUME_THREAD_QUERY_KEY = ["embedded-agent-resume-probe"] as const

/**
 * Decide where to drop the user back into the onboarding wizard based on
 * server-persisted state, so closing-and-reopening the tab mid-flow doesn't
 * force them to re-fill the questionnaire or re-start the chat.
 *
 * Resolution matrix (most-progressed first):
 *   - thread.status === 'preview_ready' → 'embedded_preview'
 *   - thread.status === 'open'          → 'embedded_chat'
 *   - profile exists, no active thread  → 'path'
 *   - profile missing                   → 'welcome'  (genuinely fresh)
 *
 * The embedded thread probe is gated on `isEmbeddedAgentEnabled()` so legacy
 * users don't pay the extra round trip. The probe is read-only (no /open
 * call): we hit `embedded_agent_threads` directly via RLS-scoped Supabase
 * select rather than `useThread()`, which would auto-create a thread row and
 * pollute the table for users who never get to the chat path.
 */
export function useOnboardingResume(): OnboardingResumeState {
  const user = useAtomValue(authAtom)
  const embeddedEnabled = isEmbeddedAgentEnabled()

  const { data: profile, isLoading: profileLoading } = useUserProfile()

  const { data: threadStatus, isLoading: threadLoading } = useQuery<EmbeddedThreadStatus>({
    queryKey: [...RESUME_THREAD_QUERY_KEY, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("embedded_agent_threads")
        .select("status")
        .in("status", ["open", "preview_ready"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return ((data?.status as EmbeddedThreadStatus) ?? null) || null
    },
    enabled: !!user && embeddedEnabled,
    // Resume is a one-shot decision per page load — no need to refetch
    // aggressively. 1-minute stale window absorbs quick remounts.
    staleTime: 1000 * 60,
  })

  const waitingForEmbeddedProbe =
    embeddedEnabled && !!user && threadStatus === undefined && threadLoading
  const isLoading = profileLoading || waitingForEmbeddedProbe

  if (isLoading) {
    return { isLoading: true, initialStep: "welcome", profile: null }
  }

  if (!profile) {
    return { isLoading: false, initialStep: "welcome", profile: null }
  }

  if (threadStatus === "preview_ready") {
    return { isLoading: false, initialStep: "embedded_preview", profile }
  }

  if (threadStatus === "open") {
    return { isLoading: false, initialStep: "embedded_chat", profile }
  }

  return { isLoading: false, initialStep: "path", profile }
}
