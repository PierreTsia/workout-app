import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import { render } from "@testing-library/react"
import { createMemoryRouter, RouterProvider } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { I18nextProvider } from "react-i18next"
import { createTestI18n } from "@/test/utils"
import { RouteErrorFallback } from "./RouteErrorFallback"

function ThrowingComponent(): never {
  throw new Error("Component blew up")
}

function renderWithRouter(routes: Parameters<typeof createMemoryRouter>[0], initialEntries: string[]) {
  const router = createMemoryRouter(routes, { initialEntries })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const i18nInstance = createTestI18n()

  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18nInstance}>
        <RouterProvider router={router} />
      </I18nextProvider>
    </QueryClientProvider>,
  )
}

describe("RouteErrorFallback", () => {
  it("catches a render error and shows the error fallback", () => {
    renderWithRouter(
      [
        {
          path: "/",
          element: <ThrowingComponent />,
          errorElement: <RouteErrorFallback />,
        },
      ],
      ["/"],
    )
    expect(screen.getByText("Dropped the bar")).toBeInTheDocument()
    expect(screen.getByText(/crashed mid-set/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Back to workout" })).toBeInTheDocument()
  })

  it("shows 404 page for unmatched routes", () => {
    renderWithRouter(
      [
        {
          path: "/",
          element: <div>Home</div>,
          errorElement: <RouteErrorFallback />,
          children: [
            {
              path: "exists",
              element: <div>Exists</div>,
            },
          ],
        },
      ],
      ["/nope"],
    )
    expect(screen.getByText("Nothing here")).toBeInTheDocument()
    expect(screen.getByText(/skipped leg day/)).toBeInTheDocument()
  })
})
