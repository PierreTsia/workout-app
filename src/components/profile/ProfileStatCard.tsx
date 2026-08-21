import type { ReactNode } from "react"
import { ArrowDown, ArrowUp } from "lucide-react"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export type ProfileStatDelta = { value: number; label: string }

export const PULSE_GRID_CLASS =
  "grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3"

export function ProfilePulseGrid({ children }: { children: ReactNode }) {
  return <div className={PULSE_GRID_CLASS}>{children}</div>
}

function VsPriorDelta({ value, label }: ProfileStatDelta) {
  const Arrow = value > 0 ? ArrowUp : value < 0 ? ArrowDown : null
  return (
    <p
      className={cn(
        "mt-1 flex items-center gap-1 text-xs font-medium",
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

function StatBody({ children }: { children: ReactNode }) {
  return (
    <CardContent className="flex flex-1 flex-col justify-center p-6">
      {children}
    </CardContent>
  )
}

export function ProfileStatCard({
  title,
  value,
  hint,
  delta,
}: {
  title: string
  value: ReactNode
  hint?: ReactNode
  delta?: ProfileStatDelta
}) {
  return (
    <Card className="flex h-full flex-col">
      <StatBody>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <p className="text-5xl font-bold tracking-tight tabular-nums">{value}</p>
        {delta ? <VsPriorDelta value={delta.value} label={delta.label} /> : null}
        {hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </StatBody>
    </Card>
  )
}

export function ProfileStatCardSkeleton() {
  return (
    <Card className="flex h-full flex-col">
      <StatBody>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-2 h-12 w-24" />
        <Skeleton className="mt-1 h-3 w-32" />
      </StatBody>
    </Card>
  )
}
