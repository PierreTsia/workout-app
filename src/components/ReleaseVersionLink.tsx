import { useTranslation } from "react-i18next"
import { ExternalLink } from "lucide-react"
import { GITHUB_RELEASES_URL } from "@/lib/releaseVersion"
import { useReleaseVersion } from "@/hooks/useReleaseVersion"

/**
 * The app's release version and a link to its notes, shared by About and
 * Account. Consumes `useReleaseVersion` (runtime read, build fallback).
 */
export function ReleaseVersionLink({ className }: { className?: string }) {
  const { t } = useTranslation("common")
  const version = useReleaseVersion()

  return (
    <p className={className}>
      <span>{t("releaseVersion", { version })}</span>{" "}
      <a
        href={GITHUB_RELEASES_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium underline-offset-2 hover:underline"
      >
        {t("releaseNotes")}
        <ExternalLink className="ml-1 inline h-3 w-3" aria-hidden />
      </a>
    </p>
  )
}
