import { useAtomValue } from "jotai"
import { Navigate, Outlet } from "react-router-dom"
import { hasProgramAtom, hasProgramLoadingAtom } from "@/store/atoms"

export function OnboardingGuard() {
  const hasProgram = useAtomValue(hasProgramAtom)
  const isLoading = useAtomValue(hasProgramLoadingAtom)

  if (isLoading) return null

  if (!hasProgram) return <Navigate to="/onboarding" replace />

  return <Outlet />
}
