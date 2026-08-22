type Translate = (key: string, opts?: Record<string, string | number>) => string

/** `delta` / `deltaDown` already add + / −. Never interpolate a signed n. */
export function vsPriorMagnitude(n: string | number): string | number {
  if (typeof n === "number") return Math.abs(n)
  return n.replace(/^[+\u2212-]+/, "")
}

export function vsPriorDelta(
  t: Translate,
  value: number,
  display: string | number = value,
): { value: number; label: string } {
  const n = vsPriorMagnitude(display)
  return {
    value,
    label:
      value === 0
        ? t("pulse.deltaEven")
        : value < 0
          ? t("pulse.deltaDown", { n })
          : t("pulse.delta", { n }),
  }
}
