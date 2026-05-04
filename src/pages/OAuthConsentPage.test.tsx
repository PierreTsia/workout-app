import { vi, describe, it, expect, beforeEach } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { OAuthConsentPage } from "./OAuthConsentPage"

const TEST_AUTH_ID = "auth-xyz-123"
const TEST_REDIRECT = "https://claude.ai/api/mcp/auth_callback?code=abc"
const TEST_USER = { id: "uid-1", email: "test@example.com" }

const mockGetUser = vi.fn()
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
  clearUserState: vi.fn(),
}))

const mockGetAuthorizationDetails = vi.fn()
const mockApproveAuthorization = vi.fn()
const mockDenyAuthorization = vi.fn()
vi.mock("@/lib/supabase-oauth", () => ({
  supabaseOAuth: {
    getAuthorizationDetails: (...args: unknown[]) =>
      mockGetAuthorizationDetails(...args),
    approveAuthorization: (...args: unknown[]) =>
      mockApproveAuthorization(...args),
    denyAuthorization: (...args: unknown[]) => mockDenyAuthorization(...args),
  },
}))

const assignSpy = vi.fn()

function renderPage() {
  return renderWithProviders(<OAuthConsentPage />, {
    initialEntries: [`/oauth/consent?authorization_id=${TEST_AUTH_ID}`],
  })
}

describe("OAuthConsentPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    assignSpy.mockClear()
    // jsdom's `window.location` is read-only; replace `assign` via defineProperty.
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, assign: assignSpy },
    })
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } })
    mockGetAuthorizationDetails.mockResolvedValue({
      data: {
        authorization_id: TEST_AUTH_ID,
        client: { name: "Claude" },
        scope: "openid email profile",
      },
      error: null,
    })
  })

  it("renders the consent UI with the client name once details load", async () => {
    renderPage()
    expect(
      await screen.findByText(/wants to access your training data/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/Claude/)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /authorize/i }),
    ).toBeInTheDocument()
  })

  it("calls approveAuthorization with skipBrowserRedirect, navigates via location.assign, and shows the success state (regression for #292)", async () => {
    mockApproveAuthorization.mockResolvedValueOnce({
      data: { redirect_url: TEST_REDIRECT },
      error: null,
    })
    const user = userEvent.setup()
    renderPage()

    const approveBtn = await screen.findByRole("button", { name: /authorize/i })
    await user.click(approveBtn)

    await waitFor(() => {
      expect(mockApproveAuthorization).toHaveBeenCalledWith(TEST_AUTH_ID, {
        skipBrowserRedirect: true,
      })
    })
    expect(assignSpy).toHaveBeenCalledWith(TEST_REDIRECT)

    expect(
      await screen.findByText(/authorization granted/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/you can close this tab/i),
    ).toBeInTheDocument()
    // Critically, the misleading error must NOT be visible.
    expect(
      screen.queryByText(/not found or expired/i),
    ).not.toBeInTheDocument()
  })

  it("surfaces the raw SDK error message when approveAuthorization fails", async () => {
    mockApproveAuthorization.mockResolvedValueOnce({
      data: null,
      error: { message: "authorization not found" },
    })
    const user = userEvent.setup()
    renderPage()

    await user.click(
      await screen.findByRole("button", { name: /authorize/i }),
    )

    expect(
      await screen.findByText("authorization not found"),
    ).toBeInTheDocument()
    expect(assignSpy).not.toHaveBeenCalled()
  })

  it("calls denyAuthorization with skipBrowserRedirect and shows the denied state", async () => {
    mockDenyAuthorization.mockResolvedValueOnce({
      data: { redirect_url: `${TEST_REDIRECT}&error=access_denied` },
      error: null,
    })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole("button", { name: /deny/i }))

    await waitFor(() => {
      expect(mockDenyAuthorization).toHaveBeenCalledWith(TEST_AUTH_ID, {
        skipBrowserRedirect: true,
      })
    })
    expect(assignSpy).toHaveBeenCalledWith(
      `${TEST_REDIRECT}&error=access_denied`,
    )
    expect(
      await screen.findByText(/authorization denied/i),
    ).toBeInTheDocument()
  })

  it("auto-navigates when getAuthorizationDetails returns redirect_url (already-consented flow)", async () => {
    mockGetAuthorizationDetails.mockResolvedValueOnce({
      data: { redirect_url: TEST_REDIRECT },
      error: null,
    })
    renderPage()

    await waitFor(() => {
      expect(assignSpy).toHaveBeenCalledWith(TEST_REDIRECT)
    })
    expect(
      await screen.findByText(/authorization granted/i),
    ).toBeInTheDocument()
  })
})
