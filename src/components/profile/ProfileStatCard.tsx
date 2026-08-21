import type { ReactNode } from "react"
import { ArrowDown, ArrowUp } from "lucide-react"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export type ProfileStatDelta = { value: number; label: string }

export type ProfileStatSize = "big" | "small"

export const PULSE_GRID_CLASS =
  "grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3"

/** Nested inside ProfileSection's Card — no second frame. */
const INNER_STAT_CLASS = "flex h-full flex-col border-0 bg-transparent shadow-none"

export function ProfilePulseGrid({ children }: { children: ReactNode }) {
  return <div className={PULSE_GRID_CLASS}>{children}</div>
}

function VsPriorDelta({ value, label }: ProfileStatDelta) {
  const Arrow = value > 0 ? ArrowUp : value < 0 ? ArrowDown : null
  return (
    <p
      className={cn(
        "mt-1 flex items-center justify-center gap-1 text-xs font-medium",
        value > 0 && "text-emerald-600 dark:text-emerald-400",
        value < 0 && "text-destructive",
        value === 0 && "text-muted-foreground",
      )}
    >
      {Arrow ? <Arrow className="h-3 w-3" aria-hidden /> : null}
      {label}
    </p>
  )
}

function StatBody({
  size,
  children,
}: {
  size: ProfileStatSize
  children: ReactNode
}) {
  return (
    <CardContent
      className={cn(
        "flex flex-1 flex-col items-center justify-center text-center",
        size === "small" ? "p-3" : "p-6",
      )}
    >
      {children}
    </CardContent>
  )
}

export function ProfileStatCard({
  title,
  value,
  hint,
  delta,
  size = "big",
}: {
  title: string
  value: ReactNode
  hint?: ReactNode
  delta?: ProfileStatDelta
  size?: ProfileStatSize
}) {
  return (
    <Card className={INNER_STAT_CLASS}>
      <StatBody size={size}>
        <CardTitle
          className={cn(
            "text-center font-medium",
            size === "small" ? "text-xs" : "text-sm",
          )}
        >
          {title}
        </CardTitle>
        <p
          className={cn(
            "font-bold tracking-tight tabular-nums",
            size === "small" ? "text-3xl" : "text-5xl",
          )}
        >
          {value}
        </p>
        {delta ? <VsPriorDelta value={delta.value} label={delta.label} /> : null}
        {hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </StatBody>
    </Card>
  )
}

export function ProfileStatCardSkeleton({
  size = "big",
}: {
  size?: ProfileStatSize
}) {
  return (
    <Card className={INNER_STAT_CLASS}>
      <StatBody size={size}>
        <Skeleton className="h-4 w-24" />
        <Skeleton className={cn("mt-2 w-16", size === "small" ? "h-8" : "h-12")} />
        <Skeleton className="mt-1 h-3 w-24" />
      </StatBody>
    </Card>
  )
}
