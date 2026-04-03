import { useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import type { AchievementRank } from "@/types/achievements"

const sizeClasses = {
  sm: "h-10 w-10",
  md: "h-16 w-16",
  lg: "h-28 w-28",
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
  /** Skip lazy loading (e.g. for the unlock overlay where the badge is immediately visible). */
  eager?: boolean
}

export function BadgeIcon({
  rank,
  iconUrl,
  size = "md",
  locked = false,
  className,
  alt = "",
  eager = false,
}: BadgeIconProps) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  const handleLoad = useCallback(() => setLoaded(true), [])
  const handleError = useCallback(() => {
    setError(true)
    setLoaded(true)
  }, [])

  const showImage = iconUrl && !error

  return (
    <div
      className={cn(
        "badge-frame",
        `badge-frame-${rank}`,
        sizeClasses[size],
        "relative overflow-hidden",
        locked && "grayscale opacity-40",
        className,
      )}
    >
      {showImage ? (
        <>
          {!loaded && (
            <Skeleton className="absolute inset-0 h-full w-full rounded-full" />
          )}
          <img
            src={iconUrl}
            alt={alt}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            onLoad={handleLoad}
            onError={handleError}
            className={cn(
              "h-full w-full object-cover transition-opacity duration-300",
              loaded ? "opacity-100" : "opacity-0",
            )}
          />
        </>
      ) : (
        <span
          className={cn(
            placeholderSize[size],
            locked ? "opacity-30" : "opacity-60",
          )}
        >
          🏆
        </span>
      )}
    </div>
  )
}
