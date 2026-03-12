import { useState, useEffect } from "react"
import { ExternalLink, Play } from "lucide-react"
import { useTranslation } from "react-i18next"
import { getYouTubeThumbnail, getYouTubeEmbedUrl } from "@/lib/youtube"

interface YouTubeLinkProps {
  url: string
}

export function YouTubeLink({ url }: YouTubeLinkProps) {
  const { t } = useTranslation("exercise")
  const [playing, setPlaying] = useState(false)
  const [thumbError, setThumbError] = useState(false)

  useEffect(() => {
    setPlaying(false)
    setThumbError(false)
  }, [url])

  const thumbnail = getYouTubeThumbnail(url)
  const embedUrl = getYouTubeEmbedUrl(url)
  if (!thumbnail || !embedUrl) return null

  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-video w-full overflow-hidden rounded-lg">
        {playing ? (
          <iframe
            src={embedUrl}
            title="YouTube"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group relative block h-full w-full"
          >
            {!thumbError ? (
              <img
                src={thumbnail}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
                onError={() => setThumbError(true)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted" />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover:bg-black/20">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 shadow-lg transition-transform group-hover:scale-110">
                <Play className="h-7 w-7 fill-white text-white" />
              </div>
            </div>
          </button>
        )}
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        {t("watchOnYouTube")}
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  )
}
