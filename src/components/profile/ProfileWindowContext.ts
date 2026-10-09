import { createContext, useContext } from "react"
import type { ProfileWindowKind } from "@/lib/profile/window"

export type ProfileWindowValue = {
  kind: ProfileWindowKind
  includeDeltas: boolean
  setKind: (kind: ProfileWindowKind) => void
}

export const ProfileWindowContext = createContext<ProfileWindowValue | null>(
  null,
)

export function useProfileWindow(): ProfileWindowValue {
  const value = useContext(ProfileWindowContext)
  if (value == null) {
    throw new Error("useProfileWindow must be used inside ProfileWindowProvider")
  }
  return value
}
