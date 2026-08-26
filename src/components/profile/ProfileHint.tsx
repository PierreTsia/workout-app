import type { ReactNode } from "react"
import { CircleHelp } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { useProgramCardLayer } from "@/components/library/programCardLayer"

export function ProfileHint({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  const layer = useProgramCardLayer()

  return (
    <Popover onOpenChange={layer?.onLayerOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="pointer-events-auto relative z-10 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          aria-label={label}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <CircleHelp className="size-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        collisionPadding={16}
        className={cn("w-auto max-w-64 p-2.5 text-xs leading-snug", className)}
      >
        {children}
      </PopoverContent>
    </Popover>
  )
}
