import { useId } from "react"
import { cn } from "@/lib/utils"
import type { AchievementRank } from "@/types/achievements"

const RING = "GYMLOGIC  ·  FITNESS APP  ·  "

const metal: Record<
  AchievementRank,
  { ring: string; mid: string; inner: string; accent: string }
> = {
  bronze: {
    ring: "#C26A16",
    mid: "#8B4E14",
    inner: "#140c06",
    accent: "#E8A04A",
  },
  silver: {
    ring: "#c8c8dc",
    mid: "#8a8aa0",
    inner: "#121216",
    accent: "#e8e8f4",
  },
  gold: {
    ring: "#F0C014",
    mid: "#C4920A",
    inner: "#161004",
    accent: "#FFE27A",
  },
  platinum: {
    ring: "#93c5fd",
    mid: "#5b8fc7",
    inner: "#0c141c",
    accent: "#dbeafe",
  },
  diamond: {
    ring: "#a855f7",
    mid: "#67e8f9",
    inner: "#120818",
    accent: "#e9d5ff",
  },
}

function LifterSilhouette({ fill }: { fill: string }) {
  return (
    <g fill={fill} stroke={fill} strokeWidth="1.6" strokeLinecap="round">
      <circle cx="60" cy="44" r="5.5" stroke="none" />
      <path d="M60 50 v20" fill="none" />
      <path d="M36 52 h48" fill="none" strokeWidth="2.2" />
      <path d="M40 48 v8M80 48 v8" fill="none" />
      <path d="M52 70 L44 90M68 70 L76 90" fill="none" />
      <path d="M48 58 L42 68M72 58 L78 68" fill="none" />
    </g>
  )
}

interface CeremonyMedalProps {
  rank: AchievementRank
  iconUrl: string | null
  alt: string
  size: number
  className?: string
}

export function CeremonyMedal({
  rank,
  iconUrl,
  alt,
  size,
  className,
}: CeremonyMedalProps) {
  const uid = useId()
  const ringPathId = `${uid}-ring`
  const clipId = `${uid}-clip`
  const discId = `${uid}-disc`
  const shineId = `${uid}-shine`
  const palette = metal[rank]
  const dualRing = rank === "diamond"

  return (
    <div
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden>
        <defs>
          <radialGradient id={discId} cx="38%" cy="32%" r="70%">
            <stop offset="0%" stopColor={palette.accent} />
            <stop offset="42%" stopColor={palette.ring} />
            <stop offset="100%" stopColor={palette.mid} />
          </radialGradient>
          <radialGradient id={shineId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={palette.inner} stopOpacity="0.2" />
            <stop offset="70%" stopColor={palette.inner} />
            <stop offset="100%" stopColor="#000" />
          </radialGradient>
          <path
            id={ringPathId}
            d="M60,60 m-40,0 a40,40 0 1,1 80,0 a40,40 0 1,1 -80,0"
          />
          <clipPath id={clipId}>
            <circle cx="60" cy="60" r="28" />
          </clipPath>
        </defs>

        <circle
          cx="60"
          cy="60"
          r="56"
          fill={palette.ring}
          opacity="0.18"
        />
        <circle cx="60" cy="60" r="50" fill={`url(#${discId})`} />
        {dualRing && (
          <circle
            cx="60"
            cy="60"
            r="46"
            fill="none"
            stroke={palette.mid}
            strokeWidth="2.4"
          />
        )}
        <circle cx="60" cy="60" r="36" fill={`url(#${shineId})`} />
        <text
          fill={rank === "diamond" ? palette.mid : palette.inner}
          fontSize="6.4"
          fontWeight="700"
          letterSpacing="1.8"
        >
          <textPath href={`#${ringPathId}`} startOffset="0">
            {RING}
          </textPath>
        </text>
        {iconUrl ? (
          <image
            href={iconUrl}
            x="32"
            y="32"
            width="56"
            height="56"
            clipPath={`url(#${clipId})`}
            preserveAspectRatio="xMidYMid slice"
          />
        ) : (
          <LifterSilhouette fill={palette.accent} />
        )}
      </svg>
    </div>
  )
}
