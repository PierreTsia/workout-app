import type { ReactElement, ReactNode } from "react"
import type { RenderOptions, RenderHookOptions } from "@testing-library/react"
import { render, renderHook } from "@testing-library/react"
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
import enAbout from "@/locales/en/about.json"
import enExercise from "@/locales/en/exercise.json"
import enFeedback from "@/locales/en/feedback.json"
import enError from "@/locales/en/error.json"
import enOnboarding from "@/locales/en/onboarding.json"

export function createTestI18n() {
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
        about: enAbout,
        exercise: enExercise,
        feedback: enFeedback,
        error: enError,
        onboarding: enOnboarding,
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
    i18nInstance,
  }
}

interface HookProviderOptions<TProps>
  extends Omit<RenderHookOptions<TProps>, "wrapper"> {
  initialEntries?: string[]
}

export function renderHookWithProviders<TResult, TProps = undefined>(
  hook: TProps extends undefined ? () => TResult : (props: TProps) => TResult,
  options: HookProviderOptions<TProps> = {} as HookProviderOptions<TProps>,
) {
  const { initialEntries = ["/"], ...hookOptions } = options

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
    ...renderHook(hook, { wrapper: Wrapper, ...hookOptions }),
    store,
    i18nInstance,
  }
}
