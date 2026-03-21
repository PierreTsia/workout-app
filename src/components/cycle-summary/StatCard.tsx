import type { LucideIcon } from "lucide-react"
import { Card } from "@/components/ui/card"
import { DeltaBadge } from "./DeltaBadge"

interface StatCardProps {
  icon: LucideIcon
  value: string | number
  label: string
  delta?: number | null
}

export function StatCard({ icon: Icon, value, label, delta }: StatCardProps) {
  return (
    <Card className="flex flex-col items-center gap-1 p-4">
      <Icon className="h-5 w-5 text-muted-foreground" />
      <div className="flex items-center gap-1.5">
        <span className="text-xl font-bold">{value}</span>
        <DeltaBadge value={delta} />
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </Card>
  )
}
