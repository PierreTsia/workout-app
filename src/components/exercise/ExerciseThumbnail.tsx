import { useState } from "react"
import { getExerciseImageUrl } from "@/lib/storage"
import { cn } from "@/lib/utils"

interface ExerciseThumbnailProps {
  imageUrl?: string | null
  emoji: string
  className?: string
}

export function ExerciseThumbnail({
  imageUrl,
  emoji,
  className,
}: ExerciseThumbnailProps) {
  const [error, setError] = useState(false)

  if (!imageUrl || error) {
    return (
      <span
        className={cn(
          "@container flex shrink-0 items-center justify-center overflow-hidden bg-muted text-center leading-none text-[max(1rem,min(3rem,45cqw))]",
          className,
        )}
      >
        {emoji}
      </span>
    )
  }

  return (
    <img
      src={getExerciseImageUrl(imageUrl)}
      alt=""
      loading="lazy"
      className={cn("shrink-0 rounded-md object-cover", className)}
      onError={() => setError(true)}
    />
  )
}
