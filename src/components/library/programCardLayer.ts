import { createContext, useContext } from "react"

export type ProgramCardLayer = {
  onLayerOpenChange: (open: boolean) => void
}

export const ProgramCardLayerContext = createContext<ProgramCardLayer | null>(
  null,
)

export function useProgramCardLayer() {
  return useContext(ProgramCardLayerContext)
}
