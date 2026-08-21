import { createContext, useContext, type ReactNode } from "react"
import {
  includeDeltas,
  type ProfileWindowKind,
} from "@/lib/profile/window"

export type ProfileWindowValue = {
  kind: ProfileWindowKind
  includeDeltas: boolean
  setKind: (kind: ProfileWindowKind) => void
}

const ProfileWindowContext = createContext<ProfileWindowValue | null>(null)

export function ProfileWindowProvider({
  kind,
  setKind,
  children,
}: {
  kind: ProfileWindowKind
  setKind: (kind: ProfileWindowKind) => void
  children: ReactNode
}) {
  return (
    <ProfileWindowContext.Provider
      value={{ kind, includeDeltas: includeDeltas(kind), setKind }}
    >
      {children}
    </ProfileWindowContext.Provider>
  )
}

export function useProfileWindow(): ProfileWindowValue {
  const value = useContext(ProfileWindowContext)
  if (value == null) {
    throw new Error("useProfileWindow must be used inside ProfileWindowProvider")
  }
  return value
}
