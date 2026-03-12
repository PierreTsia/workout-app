import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import LanguageDetector from "i18next-browser-languagedetector"

import enCommon from "@/locales/en/common.json"
import enAuth from "@/locales/en/auth.json"
import enWorkout from "@/locales/en/workout.json"
import enHistory from "@/locales/en/history.json"
import enBuilder from "@/locales/en/builder.json"
import enSettings from "@/locales/en/settings.json"

import frCommon from "@/locales/fr/common.json"
import frAuth from "@/locales/fr/auth.json"
import frWorkout from "@/locales/fr/workout.json"
import frHistory from "@/locales/fr/history.json"
import frBuilder from "@/locales/fr/builder.json"
import frSettings from "@/locales/fr/settings.json"

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        auth: enAuth,
        workout: enWorkout,
        history: enHistory,
        builder: enBuilder,
        settings: enSettings,
      },
      fr: {
        common: frCommon,
        auth: frAuth,
        workout: frWorkout,
        history: frHistory,
        builder: frBuilder,
        settings: frSettings,
      },
    },
    fallbackLng: "en",
    supportedLngs: ["en", "fr"],
    ns: ["common", "auth", "workout", "history", "builder", "settings"],
    defaultNS: "common",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "locale",
      caches: [],
    },
  })

export default i18n
