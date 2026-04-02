import { cn } from "@/lib/utils"
import type { AchievementRank } from "@/types/achievements"

const sizeClasses = {
  sm: "h-10 w-10",
  md: "h-16 w-16",
  lg: "h-28 w-28",
} as const

const iconSizeClasses = {
  sm: "h-5 w-5",
  md: "h-9 w-9",
  lg: "h-16 w-16",
} as const

const placeholderSize = {
  sm: "text-base",
  md: "text-2xl",
  lg: "text-4xl",
} as const

interface BadgeIconProps {
  rank: AchievementRank
  iconUrl: string | null
  size?: "sm" | "md" | "lg"
  locked?: boolean
  className?: string
  alt?: string
}

export function BadgeIcon({
  rank,
  iconUrl,
  size = "md",
  locked = false,
  className,
  alt = "",
}: BadgeIconProps) {
  return (
    <div
      className={cn(
        "badge-frame",
        `badge-frame-${rank}`,
        sizeClasses[size],
        locked && "grayscale opacity-40",
        className,
      )}
    >
      {iconUrl ? (
        <img
          src={iconUrl}
          alt={alt}
          className={cn("object-contain", iconSizeClasses[size])}
        />
      ) : (
        <span className={cn(placeholderSize[size], locked ? "opacity-30" : "opacity-60")}>
          🏆
        </span>
      )}
    </div>
  )
}
