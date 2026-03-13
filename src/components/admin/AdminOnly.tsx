import type { ReactNode } from "react"
import { useAtomValue } from "jotai"
import { isAdminAtom } from "@/store/atoms"

interface AdminOnlyProps {
  children: ReactNode
}

export function AdminOnly({ children }: AdminOnlyProps) {
  const isAdmin = useAtomValue(isAdminAtom)
  if (!isAdmin) return null
  return <>{children}</>
}
