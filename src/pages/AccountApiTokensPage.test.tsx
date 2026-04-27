import { vi, describe, it, expect, beforeEach } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { authAtom } from "@/store/atoms"
import type { User } from "@/types/auth"
import { AccountApiTokensPage } from "./AccountApiTokensPage"
import type { PersonalAccessToken } from "@/types/personalAccessToken"

const mockListResult = {
  data: undefined as PersonalAccessToken[] | undefined,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
}

// `vi.importActual("@/hooks/use*")` below transitively loads
// `@/lib/supabase`, which calls `createClient(...)` and fires
// `supabase.auth.getSession()` at module-eval time. On CI (no
// VITE_SUPABASE_* env), that's flaky / leaks state across tests. Stub it.
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    functions: { invoke: vi.fn() },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
  clearUserState: vi.fn(),
}))

vi.mock("@/hooks/usePersonalAccessTokens", async () => {
  const actual = await vi.importActual<
    typeof import("@/hooks/usePersonalAccessTokens")
  >("@/hooks/usePersonalAccessTokens")
  return {
    ...actual,
    usePersonalAccessTokens: () => mockListResult,
  }
})

const mockCreateMutateAsync = vi.fn()
vi.mock("@/hooks/useCreatePAT", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useCreatePAT")>(
    "@/hooks/useCreatePAT",
  )
  return {
    ...actual,
    useCreatePAT: () => ({
      mutateAsync: mockCreateMutateAsync,
      isPending: false,
      reset: vi.fn(),
    }),
  }
})

const mockRevokeMutateAsync = vi.fn()
vi.mock("@/hooks/useRevokePAT", () => ({
  useRevokePAT: () => ({
    mutateAsync: mockRevokeMutateAsync,
    isPending: false,
  }),
}))

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

const TEST_USER = { id: "uid-1", email: "test@example.com" } as unknown as User

const TOKEN_A: PersonalAccessToken = {
  id: "pat-a",
  user_id: "uid-1",
  name: "Cursor laptop",
  prefix: "glp_aaaa",
  expires_at: "2099-01-01T00:00:00Z",
  last_used_at: null,
  created_at: "2026-04-27T00:00:00Z",
}

function renderPage() {
  const result = renderWithProviders(<AccountApiTokensPage />, {
    initialEntries: ["/account/api-tokens"],
  })
  result.store.set(authAtom, TEST_USER)
  return result
}

describe("AccountApiTokensPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListResult.data = undefined
    mockListResult.isLoading = false
    mockListResult.isError = false
  })

  it("renders the loading skeleton while fetching", () => {
    mockListResult.isLoading = true
    renderPage()

    const lists = screen.getAllByRole("list")
    expect(lists.length).toBeGreaterThan(0)
    // Skeleton list is marked aria-busy on the list itself.
    expect(
      lists.some((el) => el.getAttribute("aria-busy") === "true"),
    ).toBe(true)
  })

  it("renders the empty state with a CTA when there are no tokens", () => {
    mockListResult.data = []
    renderPage()

    expect(screen.getByText(/No API tokens yet/i)).toBeInTheDocument()
    expect(
      screen.getAllByRole("button", { name: /create token/i }).length,
    ).toBeGreaterThan(0)
  })

  it("renders an error state with retry", async () => {
    mockListResult.isError = true
    const user = userEvent.setup()
    renderPage()

    expect(screen.getByText(/Could not load your tokens/i)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /retry/i }))
    expect(mockListResult.refetch).toHaveBeenCalledTimes(1)
  })

  it("renders the token list when data is available", () => {
    mockListResult.data = [TOKEN_A]
    renderPage()

    expect(screen.getByText("Cursor laptop")).toBeInTheDocument()
    expect(screen.getByText(/glp_aaaa/)).toBeInTheDocument()
    expect(screen.getByText(/Never used/i)).toBeInTheDocument()
  })

  it("disables the Create CTA when the quota is reached", () => {
    mockListResult.data = Array.from({ length: 10 }, (_, i) => ({
      ...TOKEN_A,
      id: `pat-${i}`,
      name: `Token ${i}`,
    }))
    renderPage()

    const createBtn = screen.getByRole("button", { name: /create token/i })
    expect(createBtn).toBeDisabled()
    expect(
      screen.getByText(/You've reached the limit of 10 tokens/i),
    ).toBeInTheDocument()
  })

  it("opens the create dialog when CTA is clicked", async () => {
    mockListResult.data = []
    const user = userEvent.setup()
    renderPage()

    // The empty state and the section header both render a "Create token" button;
    // either click should open the dialog.
    const ctas = screen.getAllByRole("button", { name: /create token/i })
    await user.click(ctas[0])

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })
    expect(screen.getByText("Create API token")).toBeInTheDocument()
  })

  it("opens the revoke confirmation dialog and calls the mutation", async () => {
    mockListResult.data = [TOKEN_A]
    mockRevokeMutateAsync.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole("button", { name: /Revoke token Cursor laptop/i }))

    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    })
    expect(
      screen.getByText(/Apps using "Cursor laptop" will lose access immediately/i),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /^Revoke$/i }))

    await waitFor(() => {
      expect(mockRevokeMutateAsync).toHaveBeenCalledWith("pat-a")
    })
  })
})
