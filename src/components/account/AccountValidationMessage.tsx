import { FormMessage, useFormField } from "@/components/ui/form"
import { useTranslation } from "react-i18next"

/** Zod `message` tokens → `account` i18n keys (same idea as onboarding `TranslatedFormMessage`). */
const ACCOUNT_VALIDATION_KEYS: Record<string, string> = {
  DISPLAY_NAME_MAX_LEN: "validationDisplayNameMax",
}

export function AccountValidationMessage() {
  const { t } = useTranslation("account")
  const { error } = useFormField()
  const raw = error?.message
  if (!raw) return null
  const i18nKey = ACCOUNT_VALIDATION_KEYS[raw]
  return <FormMessage>{i18nKey ? t(i18nKey) : raw}</FormMessage>
}
