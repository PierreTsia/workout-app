import { createContext, useContext, type ReactNode } from "react"

type ProgramCardLayer = {
  onLayerOpenChange: (open: boolean) => void
}

const ProgramCardLayerContext = createContext<ProgramCardLayer | null>(null)

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

export function useProgramCardLayer() {
  return useContext(ProgramCardLayerContext)
}
