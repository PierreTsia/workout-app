import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { render } from "@testing-library/react"
import { Routes, Route } from "react-router-dom"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createStore, Provider as JotaiProvider } from "jotai"
import { I18nextProvider } from "react-i18next"
import { createTestI18n } from "@/test/utils"
import { hasProgramAtom, hasProgramLoadingAtom } from "@/store/atoms"
import { OnboardingGuard } from "./OnboardingGuard"

function renderGuard(atoms: { hasProgram: boolean; loading: boolean }) {
  const store = createStore()
  store.set(hasProgramAtom, atoms.hasProgram)
  store.set(hasProgramLoadingAtom, atoms.loading)

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const i18nInstance = createTestI18n()

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <JotaiProvider store={store}>
        <QueryClientProvider client={queryClient}>
          <I18nextProvider i18n={i18nInstance}>
            <MemoryRouter initialEntries={["/"]}>
              {children}
            </MemoryRouter>
          </I18nextProvider>
        </QueryClientProvider>
      </JotaiProvider>
    )
  }

  return render(
    <Routes>
      <Route element={<OnboardingGuard />}>
        <Route path="/" element={<p>Dashboard</p>} />
      </Route>
      <Route path="/onboarding" element={<p>Onboarding</p>} />
    </Routes>,
    { wrapper: Wrapper },
  )
}

describe("OnboardingGuard", () => {
  it("renders child route when user has a program", () => {
    renderGuard({ hasProgram: true, loading: false })
    expect(screen.getByText("Dashboard")).toBeInTheDocument()
  })

  it("redirects to /onboarding when user has no program", () => {
    renderGuard({ hasProgram: false, loading: false })
    expect(screen.getByText("Onboarding")).toBeInTheDocument()
  })

  it("renders nothing while loading", () => {
    const { container } = renderGuard({ hasProgram: false, loading: true })
    expect(container.querySelector("p")).toBeNull()
  })
})
