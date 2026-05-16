import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen } from "@testing-library/react"
import { render } from "@testing-library/react"
import { createMemoryRouter, RouterProvider } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { I18nextProvider } from "react-i18next"
import { createTestI18n } from "@/test/utils"
import { RouteErrorFallback } from "./RouteErrorFallback"

const captureExceptionMock = vi.fn()
const initSentryMock = vi.fn()

vi.mock("@sentry/react", () => ({
  captureException: (...args: unknown[]) => captureExceptionMock(...args),
}))

vi.mock("@/lib/sentry", () => ({
  initSentry: (...args: unknown[]) => initSentryMock(...args),
}))

function ThrowingComponent(): never {
  throw new Error("Component blew up")
}

function ChunkLoadFailingComponent(): never {
  throw new TypeError(
    "Failed to fetch dynamically imported module: https://example.com/assets/HistoryPage-abc.js",
  )
}

function renderWithRouter(
  routes: Parameters<typeof createMemoryRouter>[0],
  initialEntries: string[],
) {
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
  beforeEach(() => {
    captureExceptionMock.mockReset()
    initSentryMock.mockReset()
  })

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
    expect(
      screen.getByRole("button", { name: "Back to workout" }),
    ).toBeInTheDocument()
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

  it("reports render errors to Sentry with the route-load taxonomy", () => {
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

    expect(initSentryMock).toHaveBeenCalled()
    expect(captureExceptionMock).toHaveBeenCalledTimes(1)
    const [captured, ctx] = captureExceptionMock.mock.calls[0]! as [
      Error,
      { tags: Record<string, string> },
    ]
    expect(captured.message).toBe("Component blew up")
    expect(ctx.tags.feature).toBe("route-load")
    expect(ctx.tags.error_kind).toBe("unknown")
    expect(ctx.tags.route).toBeTypeOf("string")
  })

  it("classifies dynamic-import failures as chunk_load_failed", () => {
    renderWithRouter(
      [
        {
          path: "/",
          element: <ChunkLoadFailingComponent />,
          errorElement: <RouteErrorFallback />,
        },
      ],
      ["/"],
    )

    expect(captureExceptionMock).toHaveBeenCalledTimes(1)
    const [, ctx] = captureExceptionMock.mock.calls[0]! as [
      Error,
      { tags: Record<string, string> },
    ]
    expect(ctx.tags.error_kind).toBe("chunk_load_failed")
  })

  it("does NOT report 404s to Sentry", () => {
    renderWithRouter(
      [
        {
          path: "/",
          element: <div>Home</div>,
          errorElement: <RouteErrorFallback />,
        },
      ],
      ["/nope"],
    )
    expect(captureExceptionMock).not.toHaveBeenCalled()
  })

  it("survives a Sentry capture throw without re-crashing the fallback", () => {
    initSentryMock.mockImplementationOnce(() => {
      throw new Error("sentry init blew up")
    })

    expect(() =>
      renderWithRouter(
        [
          {
            path: "/",
            element: <ThrowingComponent />,
            errorElement: <RouteErrorFallback />,
          },
        ],
        ["/"],
      ),
    ).not.toThrow()
    expect(screen.getByText("Dropped the bar")).toBeInTheDocument()
  })
})
