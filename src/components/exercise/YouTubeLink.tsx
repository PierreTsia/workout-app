import { useState } from "react"
import { ExternalLink, Play } from "lucide-react"
import { useTranslation } from "react-i18next"
import { getYouTubeThumbnail } from "@/lib/youtube"

interface YouTubeLinkProps {
  url: string
}

export function YouTubeLink({ url }: YouTubeLinkProps) {
  const { t } = useTranslation("exercise")
  const [thumbError, setThumbError] = useState(false)

  const thumbnail = getYouTubeThumbnail(url)
  if (!thumbnail) return null

  return (
    <div className="flex flex-col gap-2">
      {!thumbError && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="relative block">
          <img
            src={thumbnail}
            alt=""
            loading="lazy"
            className="w-full rounded-lg object-cover aspect-video"
            onError={() => setThumbError(true)}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50">
              <Play className="h-6 w-6 fill-white text-white" />
            </div>
          </div>
        </a>
      )}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {t("watchOnYouTube")}
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  )
}
