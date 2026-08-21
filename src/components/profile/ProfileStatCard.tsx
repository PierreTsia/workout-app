import type { ReactNode } from "react"
import { ArrowDown, ArrowUp } from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export type ProfileStatDelta = { value: number; label: string }

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
    <Card className="flex h-full flex-col justify-center">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-5xl font-bold tracking-tight tabular-nums">{value}</p>
        {delta ? <VsPriorDelta value={delta.value} label={delta.label} /> : null}
        {hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function ProfileStatCardSkeleton() {
  return (
    <Card className="flex h-full flex-col justify-center">
      <CardHeader className="space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Skeleton className="h-12 w-24" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  )
}
