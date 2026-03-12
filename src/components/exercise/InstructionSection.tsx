import type { LucideIcon } from "lucide-react"

interface InstructionSectionProps {
  icon: LucideIcon
  title: string
  items?: string[]
}

export function InstructionSection({
  icon: Icon,
  title,
  items,
}: InstructionSectionProps) {
  if (!items || items.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{title}</span>
      </div>
      <ul className="ml-6 list-disc space-y-0.5">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-muted-foreground">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
