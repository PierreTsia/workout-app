import { useState } from "react"
import { useAtomValue } from "jotai"
import { hasProgramAtom, hasProgramLoadingAtom } from "@/store/atoms"
import {
  useOnboardingResume,
  type OnboardingResumeStep,
} from "@/hooks/useOnboardingResume"
import type { UserProfile } from "@/types/onboarding"

export type OnboardingEntry =
  | { status: "pending" }
  | { status: "redirect" }
  | { status: "resume"; step: OnboardingResumeStep; profile: UserProfile | null }

// Stable identity so callers can hold `entry` in effect deps without re-firing
// on every render while the probes are still in flight.
const PENDING: OnboardingEntry = { status: "pending" }

/**
 * Decide, once, how the user enters the onboarding wizard: bounced home
 * because they already have a program, or resumed at a server-derived step.
 *
 * Two invariants, both load-bearing — see #420:
 *
 * 1. **Wait for both probes.** `hasProgramAtom` and `useOnboardingResume`
 *    resolve independently. Deciding on whichever answers first is a race: a
 *    user with a profile *and* a program got resumed to `path` when the resume
 *    probe won, and the bounce-home condition never became true again, leaving
 *    them stranded on `/onboarding`.
 *
 * 2. **Latch the answer.** `hasProgramAtom` flips to `true` mid-wizard from
 *    `useCreateProgram`, `useGenerateProgram` and `useEmbeddedAgentThread`,
 *    each before its own `navigate()` runs. Re-deciding on that change would
 *    read "already onboarded" and strand the user on home instead.
 */
export function useOnboardingEntry(): OnboardingEntry {
  const hasProgram = useAtomValue(hasProgramAtom)
  const hasProgramLoading = useAtomValue(hasProgramLoadingAtom)
  const resume = useOnboardingResume()
  const [decision, setDecision] = useState<OnboardingEntry | null>(null)

  const settled = !hasProgramLoading && !resume.isLoading

  if (settled && !decision) {
    setDecision(
      hasProgram
        ? { status: "redirect" }
        : { status: "resume", step: resume.initialStep, profile: resume.profile },
    )
  }

  return decision ?? PENDING
}
