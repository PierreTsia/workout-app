export type BuilderLocationState = {
  from?: string
  dayId?: string
}

export function readBuilderLocationState(
  state: unknown,
): BuilderLocationState {
  if (state == null || typeof state !== "object") return {}

  const from =
    "from" in state && typeof state.from === "string" ? state.from : undefined
  const dayId =
    "dayId" in state && typeof state.dayId === "string" && state.dayId !== ""
      ? state.dayId
      : undefined

  return { from, dayId }
}
