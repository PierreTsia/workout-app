import { useTranslation } from "react-i18next"
import { Sparkles, Copy, PenLine } from "lucide-react"

type Path = "ai" | "template" | "blank"

interface PathChoiceStepProps {
  onSelect: (path: Path) => void
}

const paths: { id: Path; icon: typeof Sparkles; accent: string }[] = [
  { id: "ai", icon: Sparkles, accent: "text-primary" },
  { id: "template", icon: Copy, accent: "text-blue-500" },
  { id: "blank", icon: PenLine, accent: "text-muted-foreground" },
]

const labelKeys: Record<Path, string> = {
  ai: "pathAI",
  template: "pathTemplate",
  blank: "pathBlank",
}

const descKeys: Record<Path, string> = {
  ai: "pathAIDescription",
  template: "pathTemplateDescription",
  blank: "pathBlankDescription",
}

export function PathChoiceStep({ onSelect }: PathChoiceStepProps) {
  const { t } = useTranslation("create-program")

  return (
    <div className="flex flex-1 flex-col gap-3 px-6 pt-4">
      <h2 className="text-lg font-semibold">{t("title")}</h2>

      <div className="flex flex-col gap-3 pt-2">
        {paths.map(({ id, icon: Icon, accent }) => (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className="flex items-start gap-4 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent/50 active:bg-accent"
          >
            <div className={`mt-0.5 ${accent}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{t(labelKeys[id])}</span>
              <span className="text-sm text-muted-foreground">{t(descKeys[id])}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
