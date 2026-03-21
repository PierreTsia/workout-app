import { useTranslation } from "react-i18next"
import { ProgramsTab } from "@/components/library/ProgramsTab"

export function TemplateChoiceStep() {
  const { t } = useTranslation("create-program")

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-6 pb-8 pt-4">
      <h2 className="text-lg font-semibold">{t("templateTitle")}</h2>
      <ProgramsTab />
    </div>
  )
}
