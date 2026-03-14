import { Sparkles, Wrench } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface PathChoiceStepProps {
  onGuided: () => void
  onSelfDirected: () => void
}

function PathCard({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: React.ElementType
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick()
        }
      }}
      className={cn(
        "cursor-pointer transition-all hover:border-primary hover:shadow-md",
        "active:scale-[0.98]",
      )}
    >
      <CardHeader className="items-center text-center">
        <div className="mb-2 rounded-xl bg-primary/10 p-3">
          <Icon className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  )
}

export function PathChoiceStep({ onGuided, onSelfDirected }: PathChoiceStepProps) {
  const { t } = useTranslation("onboarding")

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
      <h1 className="text-2xl font-bold">{t("pathTitle")}</h1>
      <div className="grid w-full max-w-sm gap-4">
        <PathCard
          icon={Sparkles}
          title={t("guidedTitle")}
          description={t("guidedDescription")}
          onClick={onGuided}
        />
        <PathCard
          icon={Wrench}
          title={t("selfDirectedTitle")}
          description={t("selfDirectedDescription")}
          onClick={onSelfDirected}
        />
      </div>
    </div>
  )
}
