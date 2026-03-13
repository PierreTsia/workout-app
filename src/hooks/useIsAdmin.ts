import { useAtomValue } from "jotai"
import { isAdminAtom, isAdminLoadingAtom } from "@/store/atoms"

export function useIsAdmin() {
  const isAdmin = useAtomValue(isAdminAtom)
  const isLoading = useAtomValue(isAdminLoadingAtom)
  return { isAdmin, isLoading }
}
