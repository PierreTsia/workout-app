import { Dumbbell } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"

interface WelcomeStepProps {
  onNext: () => void
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  const { t } = useTranslation("onboarding")

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="rounded-2xl bg-primary/10 p-5">
        <Dumbbell className="h-14 w-14 text-primary" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight">{t("welcomeTitle")}</h1>
      <p className="max-w-sm text-muted-foreground">{t("welcomeDescription")}</p>
      <Button size="lg" onClick={onNext} className="mt-4 w-full max-w-xs">
        {t("getStarted")}
      </Button>
    </div>
  )
}
