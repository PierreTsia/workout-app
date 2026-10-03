import type { TFunction } from "i18next"

/** Zod `message` tokens → `account` i18n keys (same idea as onboarding `TranslatedFormMessage`). */
const ACCOUNT_VALIDATION_KEYS: Record<string, string> = {
  DISPLAY_NAME_MIN_LEN: "validationDisplayNameMin",
  DISPLAY_NAME_MAX_LEN: "validationDisplayNameMax",
}

/**
 * The `Field.error` value for the account form: maps a raw zod `message` token to
 * its translated `account` copy, or passes an already-human message through.
 */
export function accountValidationMessage(
  raw: string | undefined,
  t: TFunction,
): string | undefined {
  if (!raw) return undefined
  const i18nKey = ACCOUNT_VALIDATION_KEYS[raw]
  return i18nKey ? t(i18nKey) : raw
}
