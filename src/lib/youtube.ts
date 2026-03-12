const YOUTUBE_REGEX =
  /(?:youtube\.com\/(?:watch\?.*v=|shorts\/)|youtu\.be\/)([\w-]{11})/

export function extractVideoId(url: string): string | null {
  const match = url.match(YOUTUBE_REGEX)
  return match?.[1] ?? null
}

export function getYouTubeThumbnail(url: string): string | null {
  const id = extractVideoId(url)
  if (!id) return null
  return `https://img.youtube.com/vi/${id}/mqdefault.jpg`
}
