import { useAtomValue } from "jotai"
import { Navigate, Outlet } from "react-router-dom"
import { isAdminAtom, isAdminLoadingAtom } from "@/store/atoms"

export function AdminGuard() {
  const isAdmin = useAtomValue(isAdminAtom)
  const isLoading = useAtomValue(isAdminLoadingAtom)

  if (isLoading) return null

  if (!isAdmin) return <Navigate to="/" replace />

  return <Outlet />
}
