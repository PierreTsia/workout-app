import { Link } from "react-router-dom"
import { Trans, useTranslation } from "react-i18next"
import { ArrowLeft, Wifi, GitBranch, Shield, Heart, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

const GITHUB_REPO = "https://github.com/PierreTsia/workout-app"
const GITHUB_PROFILE = "https://github.com/PierreTsia"

export function AboutPage() {
  const { t } = useTranslation("about")

  return (
    <div
      className="flex min-h-screen flex-col items-center p-4"
      style={{ background: "#0f0f13" }}
    >
      <div className="w-full max-w-2xl">
        <nav className="mb-8 pt-2">
          <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
            <Link to="/">
              <ArrowLeft className="mr-1 h-4 w-4" />
              {t("goToApp")}
            </Link>
          </Button>
        </nav>

        <div className="mb-12 flex flex-col items-center gap-2 text-center">
          <span className="text-5xl">🏋️</span>
          <h1 className="text-4xl font-bold text-white">{t("heroTitle")}</h1>
          <p className="text-lg text-muted-foreground">{t("heroTagline")}</p>
        </div>

        <section className="mb-10">
          <h2 className="mb-4 text-xl font-semibold text-white">{t("storyTitle")}</h2>
          <p className="mb-3 leading-relaxed text-muted-foreground">{t("storyP1")}</p>
          <p className="leading-relaxed text-muted-foreground">{t("storyP2")}</p>
        </section>

        <Separator className="mb-10" />

        <section className="mb-10">
          <h2 className="mb-4 text-xl font-semibold text-white">{t("featuresTitle")}</h2>
          <ul className="flex flex-col gap-3">
            <FeatureItem icon={<Wifi className="h-5 w-5 text-teal" />} text={t("featurePwa")} />
            <FeatureItem icon={<GitBranch className="h-5 w-5 text-teal" />} text={t("featureOpenSource")} />
            <FeatureItem icon={<Shield className="h-5 w-5 text-teal" />} text={t("featurePrivacy")} />
            <FeatureItem icon={<Heart className="h-5 w-5 text-teal" />} text={t("featureFree")} />
          </ul>
        </section>

        <Separator className="mb-10" />

        <section className="mb-10">
          <h2 className="mb-4 text-xl font-semibold text-white">{t("openSourceTitle")}</h2>
          <p className="mb-4 leading-relaxed text-muted-foreground">{t("openSourceDescription")}</p>
          <Button variant="outline" asChild>
            <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer">
              <GitBranch className="mr-2 h-4 w-4" />
              {t("viewOnGithub")}
              <ExternalLink className="ml-2 h-3 w-3" />
            </a>
          </Button>
        </section>

        <Separator className="mb-10" />

        <section className="mb-10">
          <h2 className="mb-4 text-xl font-semibold text-white">{t("supportTitle")}</h2>
          <p className="mb-4 leading-relaxed text-muted-foreground">{t("supportDescription")}</p>
          <span className="inline-block rounded-full border border-border px-4 py-1.5 text-sm text-muted-foreground">
            {t("supportComingSoon")}
          </span>
        </section>

        <Separator className="mb-10" />

        <section className="mb-16">
          <h2 className="mb-4 text-xl font-semibold text-white">{t("creditsTitle")}</h2>
          <p className="text-muted-foreground">
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
                    className="font-medium text-teal hover:underline"
                  />
                ),
              }}
            />
          </p>
          <p className="text-sm text-muted-foreground/70">{t("creditsAi")}</p>
        </section>
      </div>
    </div>
  )
}

function FeatureItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-3">
      {icon}
      <span className="text-muted-foreground">{text}</span>
    </li>
  )
}
