import type { ReactNode } from "react"
import {
  includeDeltas,
  type ProfileWindowKind,
} from "@/lib/profile/window"
import { ProfileWindowContext } from "@/components/profile/ProfileWindowContext"

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
