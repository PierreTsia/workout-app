import { ArrowUp, ArrowDown } from "lucide-react"

interface DeltaBadgeProps {
  value: number | null | undefined
}

export function DeltaBadge({ value }: DeltaBadgeProps) {
  if (value == null || value === 0) return null

  const isPositive = value > 0

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${
        isPositive
          ? "bg-emerald-500/10 text-emerald-400"
          : "bg-red-500/10 text-red-400"
      }`}
    >
      {isPositive ? (
        <ArrowUp className="h-3 w-3" />
      ) : (
        <ArrowDown className="h-3 w-3" />
      )}
      {isPositive ? "+" : ""}
      {value}%
    </span>
  )
}
