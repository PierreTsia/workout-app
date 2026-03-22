import { Link } from "react-router-dom"
import { ArrowLeft, Mail } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-lg font-semibold text-white">{title}</h2>
      <div className="flex flex-col gap-2 leading-relaxed text-muted-foreground">{children}</div>
    </section>
  )
}

export function PrivacyPage() {
  const { t } = useTranslation("privacy")

  return (
    <div className="flex min-h-screen flex-col items-center p-4" style={{ background: "#0f0f13" }}>
      <div className="w-full max-w-2xl">
        <nav className="mb-8 pt-2">
          <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
            <Link to="/">
              <ArrowLeft className="mr-1 h-4 w-4" />
              {t("backToApp")}
            </Link>
          </Button>
        </nav>

        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("lastUpdated")}</p>
        </div>

        <Section title={t("s1Title")}>
          <p>{t("s1Body")}</p>
        </Section>

        <Separator className="mb-10" />

        <Section title={t("s2Title")}>
          <p>{t("s2Auth")}</p>
          <p>{t("s2Profile")}</p>
          <p>{t("s2Workout")}</p>
          <p>{t("s2Analytics")}</p>
          <p>{t("s2AI")}</p>
          <p>{t("s2Device")}</p>
        </Section>

        <Separator className="mb-10" />

        <Section title={t("s3Title")}>
          <p>{t("s3Body")}</p>
        </Section>

        <Separator className="mb-10" />

        <Section title={t("s4Title")}>
          <p>{t("s4Active")}</p>
          <p>{t("s4Analytics")}</p>
          <p>{t("s4Avatar")}</p>
        </Section>

        <Separator className="mb-10" />

        <Section title={t("s5Title")}>
          <p>{t("s5Access")}</p>
          <p>{t("s5Delete")}</p>
          <p className="flex items-center gap-1.5">
            <Mail className="h-4 w-4 shrink-0" />
            <span>{t("s5Contact")}</span>
          </p>
        </Section>

        <Separator className="mb-10" />

        <Section title={t("s6Title")}>
          <p>{t("s6Body")}</p>
        </Section>

        <Separator className="mb-10" />

        <Section title={t("s7Title")}>
          <p>{t("s7Body")}</p>
        </Section>
      </div>
    </div>
  )
}
