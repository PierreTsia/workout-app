import { Link } from "react-router-dom"
import { Trans, useTranslation } from "react-i18next"
import {
  ArrowLeft,
  Wifi,
  GitBranch,
  Shield,
  Heart,
  ExternalLink,
  Dumbbell,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"

const GITHUB_REPO = "https://github.com/PierreTsia/workout-app"
const GITHUB_PROFILE = "https://github.com/PierreTsia"

const ACCENT = "text-[#00c9a7]"

export function AboutPage() {
  const { t } = useTranslation("about")

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0f0f13] text-white">
      <div
        className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#00c9a7]/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-violet-500/5 blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto max-w-3xl px-4 py-10 md:py-14">
        <nav className="mb-8">
          <Button
            variant="ghost"
            size="sm"
            className="text-zinc-400 hover:text-white"
            asChild
          >
            <Link to="/">
              <ArrowLeft className="mr-1 h-4 w-4" />
              {t("goToApp")}
            </Link>
          </Button>
        </nav>

        <header className="mb-10 text-center">
          <div className="mb-6 flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#00c9a7]/25 bg-[#00c9a7]/10">
              <Dumbbell className="h-9 w-9 text-[#00c9a7]" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                {t("heroTitle")}
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-lg leading-relaxed text-zinc-400">
                {t("heroTagline")}
              </p>
            </div>
          </div>
        </header>

        <div className="flex flex-col gap-6">
          <AboutSection title={t("storyTitle")}>
            <p className="mb-3 leading-relaxed text-zinc-400">{t("storyP1")}</p>
            <p className="leading-relaxed text-zinc-400">{t("storyP2")}</p>
          </AboutSection>

          <AboutSection title={t("featuresTitle")}>
            <ul className="flex flex-col gap-4">
              <FeatureItem
                icon={<Wifi className={`h-5 w-5 shrink-0 ${ACCENT}`} strokeWidth={2.5} />}
                text={t("featurePwa")}
              />
              <FeatureItem
                icon={<Sparkles className={`h-5 w-5 shrink-0 ${ACCENT}`} strokeWidth={2.5} />}
                text={t("featureAi")}
              />
              <FeatureItem
                icon={<GitBranch className={`h-5 w-5 shrink-0 ${ACCENT}`} strokeWidth={2.5} />}
                text={t("featureOpenSource")}
              />
              <FeatureItem
                icon={<Shield className={`h-5 w-5 shrink-0 ${ACCENT}`} strokeWidth={2.5} />}
                text={t("featurePrivacy")}
              />
              <FeatureItem
                icon={<Heart className={`h-5 w-5 shrink-0 ${ACCENT}`} strokeWidth={2.5} />}
                text={t("featureFree")}
              />
            </ul>
          </AboutSection>

          <AboutSection title={t("openSourceTitle")}>
            <p className="mb-4 leading-relaxed text-zinc-400">
              {t("openSourceDescription")}
            </p>
            <Button
              variant="outline"
              className="border-white/15 bg-transparent text-white hover:bg-white/5"
              asChild
            >
              <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer">
                <GitBranch className="mr-2 h-4 w-4" />
                {t("viewOnGithub")}
                <ExternalLink className="ml-2 h-3 w-3" />
              </a>
            </Button>
          </AboutSection>

          <AboutSection title={t("supportTitle")}>
            <p className="mb-4 leading-relaxed text-zinc-400">
              {t("supportDescription")}
            </p>
            <span className="inline-block rounded-full border border-white/10 bg-zinc-900/50 px-4 py-1.5 text-sm text-zinc-500">
              {t("supportComingSoon")}
            </span>
          </AboutSection>

          <AboutSection title={t("creditsTitle")} className="mb-8">
            <p className="text-zinc-400">
              <Trans
                i18nKey="creditsCreator"
                ns="about"
                components={{
                  heart: <span className="text-red-500">❤️</span>,
                  author: (
                    <a
                      href={GITHUB_PROFILE}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-[#00c9a7] hover:underline"
                    />
                  ),
                }}
              />
            </p>
            <p className="mt-2 text-sm text-zinc-500">{t("creditsAi")}</p>
          </AboutSection>
        </div>
      </div>
    </div>
  )
}

function AboutSection({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-2xl border border-white/10 bg-zinc-900/40 p-6 shadow-lg backdrop-blur-md md:p-8 ${className ?? ""}`}
    >
      <h2 className="mb-4 text-lg font-semibold text-white md:text-xl">{title}</h2>
      {children}
    </section>
  )
}

function FeatureItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-start gap-3 text-left">
      <span className="mt-0.5">{icon}</span>
      <span className="text-[15px] leading-snug text-zinc-300 md:text-base">{text}</span>
    </li>
  )
}
