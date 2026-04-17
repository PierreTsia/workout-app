"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"

export interface MultiSelectOption {
  value: string
  label: string
}

interface MultiSelectProps {
  options: MultiSelectOption[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  /** Optional label for the trigger (e.g. section sub-label) */
  triggerClassName?: string
  contentClassName?: string
  disabled?: boolean
  id?: string
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  triggerClassName,
  contentClassName,
  disabled,
  id,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)

  const toggle = (optValue: string) => {
    const next = value.includes(optValue)
      ? value.filter((v) => v !== optValue)
      : [...value, optValue]
    onChange(next)
  }

  const firstLabel = value.length > 0
    ? options.find((o) => o.value === value[0])?.label ?? value[0]
    : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-between font-normal",
            value.length === 0 && "text-muted-foreground",
            triggerClassName,
          )}
        >
          {value.length === 0 ? (
            <span className="truncate">{placeholder}</span>
          ) : (
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate">{firstLabel}</span>
              {value.length > 1 && (
                <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
                  +{value.length - 1}
                </span>
              )}
            </span>
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-(--radix-popover-trigger-width) p-0", contentClassName)} align="start">
        <ScrollArea className="max-h-64">
          <div className="flex flex-col gap-1 p-2">
            {options.map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <Checkbox
                  checked={value.includes(opt.value)}
                  onCheckedChange={() => toggle(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
