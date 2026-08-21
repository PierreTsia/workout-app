import type { ReactNode } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export type ProfileSectionStatus = "ok" | "empty" | "loading" | "error"

export function ProfileSection({
  title,
  status,
  empty,
  error,
  children,
}: {
  title: string
  status: ProfileSectionStatus
  empty: ReactNode
  error?: ReactNode
  children?: ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      </CardHeader>
      <CardContent>
        {status === "loading" ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : null}
        {status === "error" ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {status === "empty" ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : null}
        {status === "ok" ? children : null}
      </CardContent>
    </Card>
  )
}
