import type { ReactElement, ReactNode } from "react"
import type { RenderOptions } from "@testing-library/react"
import { render } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createStore, Provider as JotaiProvider } from "jotai"
import { I18nextProvider } from "react-i18next"
import { MemoryRouter } from "react-router-dom"
import i18n from "i18next"
import { initReactI18next } from "react-i18next"

import enCommon from "@/locales/en/common.json"
import enAuth from "@/locales/en/auth.json"
import enWorkout from "@/locales/en/workout.json"
import enHistory from "@/locales/en/history.json"
import enBuilder from "@/locales/en/builder.json"
import enSettings from "@/locales/en/settings.json"

function createTestI18n() {
  const instance = i18n.createInstance()
  instance.use(initReactI18next).init({
    lng: "en",
    resources: {
      en: {
        common: enCommon,
        auth: enAuth,
        workout: enWorkout,
        history: enHistory,
        builder: enBuilder,
        settings: enSettings,
      },
    },
    defaultNS: "common",
    interpolation: { escapeValue: false },
  })
  return instance
}

interface ProviderOptions extends Omit<RenderOptions, "wrapper"> {
  initialEntries?: string[]
}

export function renderWithProviders(
  ui: ReactElement,
  options: ProviderOptions = {},
) {
  const { initialEntries = ["/"], ...renderOptions } = options

  const store = createStore()
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  const i18nInstance = createTestI18n()

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <JotaiProvider store={store}>
        <QueryClientProvider client={queryClient}>
          <I18nextProvider i18n={i18nInstance}>
            <MemoryRouter initialEntries={initialEntries}>
              {children}
            </MemoryRouter>
          </I18nextProvider>
        </QueryClientProvider>
      </JotaiProvider>
    )
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    store,
    queryClient,
  }
}
