import { useAtomValue } from "jotai"
import { Navigate, Outlet } from "react-router-dom"
import { authAtom } from "@/store/atoms"

export function AuthGuard() {
  const user = useAtomValue(authAtom)

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
