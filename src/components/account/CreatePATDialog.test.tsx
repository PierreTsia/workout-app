import { vi, describe, it, expect, beforeEach } from "vitest"
import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { CreatePATDialog } from "./CreatePATDialog"
import {
  DuplicateNameError,
  PATForbiddenError,
  QuotaExceededError,
} from "@/hooks/useCreatePAT"

// vi.mock factories are hoisted above all `const` declarations, so anything
// they reference must be declared via `vi.hoisted(...)` to be available at
// hoist-time. See https://vitest.dev/api/vi.html#vi-hoisted.
const { mockMutateAsync, mockToastError, mockToastSuccess } = vi.hoisted(() => ({
  mockMutateAsync: vi.fn(),
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
}))

// `vi.importActual("@/hooks/useCreatePAT")` below transitively loads
// `@/lib/supabase`, which calls `createClient(...)` and
// `supabase.auth.getSession()` at module-eval time. On CI, without
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, that import is fragile and
// the top-level network call leaks into other tests. Stub it here.
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

vi.mock("@/hooks/useCreatePAT", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useCreatePAT")>(
    "@/hooks/useCreatePAT",
  )
  return {
    ...actual,
    useCreatePAT: () => ({
      mutateAsync: mockMutateAsync,
      isPending: false,
      reset: vi.fn(),
    }),
  }
})

vi.mock("sonner", () => ({
  toast: { error: mockToastError, success: mockToastSuccess },
}))

function renderDialog(onClose = vi.fn()) {
  return {
    onClose,
    ...renderWithProviders(<CreatePATDialog open onClose={onClose} />),
  }
}

describe("CreatePATDialog — form mode", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders the form with default lifetime = 30 days", () => {
    renderDialog()
    expect(screen.getByText("Create API token")).toBeInTheDocument()
    // Radix Select renders a hidden native <select> for form integration; we
    // assert against that since clicking the Radix trigger doesn't work in
    // jsdom (missing hasPointerCapture).
    const native = document.querySelector(
      "select[aria-hidden='true']",
    ) as HTMLSelectElement | null
    expect(native?.value).toBe("30")
  })

  it("blocks submit when name is empty", async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole("button", { name: /create token/i }))

    await waitFor(() => {
      expect(
        screen.getByText(/Pick a name \(at least 1 character\)/i),
      ).toBeInTheDocument()
    })
    expect(mockMutateAsync).not.toHaveBeenCalled()
  })

  it("submits with trimmed name and lifetime_days = 30", async () => {
    mockMutateAsync.mockResolvedValueOnce({
      token: "glp_secret123",
      prefix: "glp_secr",
      expires_at: "2026-05-27T00:00:00Z",
    })

    const user = userEvent.setup()
    renderDialog()

    await user.type(screen.getByRole("textbox"), "  Cursor laptop  ")
    await user.click(screen.getByRole("button", { name: /create token/i }))

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        name: "Cursor laptop",
        lifetime_days: 30,
      })
    })
  })

  it("shows the never-expiry warning when 'never' is selected", async () => {
    const user = userEvent.setup()
    renderDialog()

    // Radix Select's hidden native <select> is what react-hook-form actually
    // controls; selecting on it fires the change event the same way Radix
    // would after a click in a real browser.
    const native = document.querySelector(
      "select[aria-hidden='true']",
    ) as HTMLSelectElement
    await user.selectOptions(native, "never")

    expect(
      screen.getByText(/Never-expiring tokens require strict opsec/i),
    ).toBeInTheDocument()
  })

  it("maps DuplicateNameError to a field-level error on name", async () => {
    mockMutateAsync.mockRejectedValueOnce(new DuplicateNameError())

    const user = userEvent.setup()
    renderDialog()

    await user.type(screen.getByRole("textbox"), "dup")
    await user.click(screen.getByRole("button", { name: /create token/i }))

    await waitFor(() => {
      expect(
        screen.getByText(/already have a token with that name/i),
      ).toBeInTheDocument()
    })
    // No global toast for duplicate name — the inline message is the UX.
    expect(mockToastError).not.toHaveBeenCalled()
  })

  it("shows toast and closes on QuotaExceededError", async () => {
    mockMutateAsync.mockRejectedValueOnce(new QuotaExceededError())

    const user = userEvent.setup()
    const { onClose } = renderDialog()

    await user.type(screen.getByRole("textbox"), "x")
    await user.click(screen.getByRole("button", { name: /create token/i }))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    })
  })

  it("shows toast and closes on PATForbiddenError", async () => {
    mockMutateAsync.mockRejectedValueOnce(new PATForbiddenError())

    const user = userEvent.setup()
    const { onClose } = renderDialog()

    await user.type(screen.getByRole("textbox"), "x")
    await user.click(screen.getByRole("button", { name: /create token/i }))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    })
  })

  it("shows generic toast on unexpected errors and stays open", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("network exploded"))

    const user = userEvent.setup()
    const { onClose } = renderDialog()

    await user.type(screen.getByRole("textbox"), "x")
    await user.click(screen.getByRole("button", { name: /create token/i }))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled()
    })
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe("CreatePATDialog — success view", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("switches to success mode and reveals the plaintext token", async () => {
    mockMutateAsync.mockResolvedValueOnce({
      token: "glp_PLAINTEXTSECRET",
      prefix: "glp_PLAI",
      expires_at: null,
    })

    const user = userEvent.setup()
    renderDialog()

    await user.type(screen.getByRole("textbox"), "Cursor")
    await user.click(screen.getByRole("button", { name: /create token/i }))

    await waitFor(() => {
      expect(screen.getByText("Token created")).toBeInTheDocument()
    })
    expect(screen.getByTestId("pat-plaintext")).toHaveTextContent(
      "glp_PLAINTEXTSECRET",
    )
    // The form must be gone — no double-submit possible.
    expect(
      screen.queryByRole("button", { name: /^create token$/i }),
    ).not.toBeInTheDocument()
  })

  it("copies the token via the Copy button", async () => {
    mockMutateAsync.mockResolvedValueOnce({
      token: "glp_copyme",
      prefix: "glp_copy",
      expires_at: null,
    })

    // user-event v14 installs its own clipboard polyfill on `navigator` during
    // `setup()`, so we attach the spy AFTER it's in place.
    const user = userEvent.setup()
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined)

    renderDialog()
    await user.type(screen.getByRole("textbox"), "X")
    await user.click(screen.getByRole("button", { name: /create token/i }))

    const copyBtn = await screen.findByRole("button", { name: /^copy$/i })
    await user.click(copyBtn)

    expect(writeText).toHaveBeenCalledWith("glp_copyme")
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument()
    })
  })

  it("only closes via the explicit Done button", async () => {
    mockMutateAsync.mockResolvedValueOnce({
      token: "glp_x",
      prefix: "glp_x",
      expires_at: null,
    })

    const user = userEvent.setup()
    const { onClose } = renderDialog()
    await user.type(screen.getByRole("textbox"), "X")
    await user.click(screen.getByRole("button", { name: /create token/i }))

    const dialog = await screen.findByRole("dialog")
    // Escape would close in form mode but must NOT close in success mode.
    await user.keyboard("{Escape}")
    expect(onClose).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole("button", { name: /done/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
