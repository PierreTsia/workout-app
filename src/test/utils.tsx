import type { ReactElement, ReactNode } from "react"
import type { RenderOptions, RenderHookOptions } from "@testing-library/react"
import { render, renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createStore, Provider as JotaiProvider } from "jotai"
import { I18nextProvider } from "react-i18next"
import { MemoryRouter, type InitialEntry } from "react-router-dom"
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
import enLibrary from "@/locales/en/library.json"
import enGenerator from "@/locales/en/generator.json"
import enCreateProgram from "@/locales/en/create-program.json"
import enAccount from "@/locales/en/account.json"
import enPrivacy from "@/locales/en/privacy.json"
import enAdmin from "@/locales/en/admin.json"
import type { UseQueryResult } from "@tanstack/react-query"
import enAchievements from "@/locales/en/achievements.json"
import enApiTokens from "@/locales/en/api-tokens.json"
import enCatalog from "@/locales/en/catalog.json"
import enProfile from "@/locales/en/profile.json"
import enProgram from "@/locales/en/program.json"

// Keep this list ordered identically to the `en` imports above: the two
// drifting apart is this file's obvious failure mode.
import frCommon from "@/locales/fr/common.json"
import frAuth from "@/locales/fr/auth.json"
import frWorkout from "@/locales/fr/workout.json"
import frHistory from "@/locales/fr/history.json"
import frBuilder from "@/locales/fr/builder.json"
import frSettings from "@/locales/fr/settings.json"
import frAbout from "@/locales/fr/about.json"
import frExercise from "@/locales/fr/exercise.json"
import frFeedback from "@/locales/fr/feedback.json"
import frError from "@/locales/fr/error.json"
import frOnboarding from "@/locales/fr/onboarding.json"
import frLibrary from "@/locales/fr/library.json"
import frGenerator from "@/locales/fr/generator.json"
import frCreateProgram from "@/locales/fr/create-program.json"
import frAccount from "@/locales/fr/account.json"
import frPrivacy from "@/locales/fr/privacy.json"
import frAdmin from "@/locales/fr/admin.json"
import frAchievements from "@/locales/fr/achievements.json"
import frApiTokens from "@/locales/fr/api-tokens.json"
import frCatalog from "@/locales/fr/catalog.json"
import frProfile from "@/locales/fr/profile.json"
import frProgram from "@/locales/fr/program.json"

const testResources = {
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
    library: enLibrary,
    generator: enGenerator,
    "create-program": enCreateProgram,
    account: enAccount,
    privacy: enPrivacy,
    admin: enAdmin,
    achievements: enAchievements,
    "api-tokens": enApiTokens,
    catalog: enCatalog,
    profile: enProfile,
    program: enProgram,
  },
  fr: {
    common: frCommon,
    auth: frAuth,
    workout: frWorkout,
    history: frHistory,
    builder: frBuilder,
    settings: frSettings,
    about: frAbout,
    exercise: frExercise,
    feedback: frFeedback,
    error: frError,
    onboarding: frOnboarding,
    library: frLibrary,
    generator: frGenerator,
    "create-program": frCreateProgram,
    account: frAccount,
    privacy: frPrivacy,
    admin: frAdmin,
    achievements: frAchievements,
    "api-tokens": frApiTokens,
    catalog: frCatalog,
    profile: frProfile,
    program: frProgram,
  },
}

export type TestLocale = keyof typeof testResources

export function createTestI18n({ lng = "en" }: { lng?: TestLocale } = {}) {
  const instance = i18n.createInstance()
  instance.use(initReactI18next).init({
    lng,
    resources: testResources,
    fallbackLng: "en",
    supportedLngs: Object.keys(testResources),
    defaultNS: "common",
    interpolation: { escapeValue: false },
  })
  return instance
}

interface ProviderOptions extends Omit<RenderOptions, "wrapper"> {
  initialEntries?: InitialEntry[]
  locale?: TestLocale
}

export function renderWithProviders(
  ui: ReactElement,
  options: ProviderOptions = {},
) {
  const { initialEntries = ["/"], locale, ...renderOptions } = options

  const store = createStore()
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  const i18nInstance = createTestI18n({ lng: locale })

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
  locale?: TestLocale
}

export function renderHookWithProviders<TResult, TProps = undefined>(
  hook: TProps extends undefined ? () => TResult : (props: TProps) => TResult,
  options: HookProviderOptions<TProps> = {} as HookProviderOptions<TProps>,
) {
  const { initialEntries = ["/"], locale, ...hookOptions } = options

  const store = createStore()
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  const i18nInstance = createTestI18n({ lng: locale })

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
    queryClient,
    i18nInstance,
  }
}

const queryResultDefaults = {
  dataUpdatedAt: 0,
  error: null,
  errorUpdateCount: 0,
  errorUpdatedAt: 0,
  failureCount: 0,
  failureReason: null,
  fetchStatus: "idle" as const,
  isError: false,
  isFetched: true,
  isFetchedAfterMount: true,
  isFetching: false,
  isInitialLoading: false,
  isLoading: false,
  isLoadingError: false,
  isPaused: false,
  isPending: false,
  isPlaceholderData: false,
  isRefetchError: false,
  isRefetching: false,
  isStale: false,
  isSuccess: true,
  isEnabled: true,
  refetch: (() => Promise.resolve({ data: undefined, isError: false, error: null, isSuccess: true, status: "success" as const, dataUpdatedAt: 0, errorUpdateCount: 0, errorUpdatedAt: 0, failureCount: 0, failureReason: null, fetchStatus: "idle" as const, isFetched: true, isFetchedAfterMount: true, isFetching: false, isInitialLoading: false, isLoading: false, isLoadingError: false, isPaused: false, isPending: false, isPlaceholderData: false, isRefetchError: false, isRefetching: false, isStale: false })) as UseQueryResult["refetch"],
  status: "success" as const,
} satisfies Omit<UseQueryResult, "data">

export function mockQueryResult<T>(data: T): UseQueryResult<T, Error> {
  return { ...queryResultDefaults, data } as UseQueryResult<T, Error>
}
