import { useIsAdmin } from "@/hooks/useIsAdmin"
import { useActiveProgram } from "@/hooks/useActiveProgram"

/**
 * Mounts the admin + active-program React Query hooks so their results mirror
 * into the shared Jotai atoms read by `AdminGuard`, `OnboardingGuard`,
 * `AdminOnly`, `WorkoutPage`, and `syncService`.
 *
 * Rendered inside `AuthGuard` (which already bails on `authLoading` / missing
 * user) so both queries only fire for authenticated sessions and dedupe via
 * React Query regardless of who consumes them downstream.
 */
export function AuthDataBridge() {
  useIsAdmin()
  useActiveProgram()
  return null
}
