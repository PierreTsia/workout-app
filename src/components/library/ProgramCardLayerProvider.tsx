import type { ReactNode } from "react"
import {
  ProgramCardLayerContext,
  type ProgramCardLayer,
} from "@/components/library/programCardLayer"

export function ProgramCardLayerProvider({
  value,
  children,
}: {
  value: ProgramCardLayer
  children: ReactNode
}) {
  return (
    <ProgramCardLayerContext.Provider value={value}>
      {children}
    </ProgramCardLayerContext.Provider>
  )
}
