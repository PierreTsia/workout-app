import { vi, describe, it, expect, beforeEach } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { authAtom, weightUnitAtom } from "@/store/atoms"
import type { User } from "@/types/auth"
import type { UserProfile } from "@/types/onboarding"
import { AccountPage } from "./AccountPage"

// --- mocks ---

const mockDeleteMutateAsync = vi.fn()
const mockUpdateMutateAsync = vi.fn()

vi.mock("@/hooks/useDeleteAccount", () => ({
  useDeleteAccount: () => ({
    mutateAsync: mockDeleteMutateAsync,
    isPending: false,
  }),
}))

vi.mock("@/hooks/useUpdateUserProfile", () => ({
  useUpdateUserProfile: () => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  }),
}))

const mockProfile: UserProfile = {
  user_id: "uid-1",
  display_name: "Pierre Test",
  avatar_url: null,
  age: 30,
  weight_kg: 80,
  gender: "male",
  goal: "strength" as const,
  experience: "intermediate" as const,
  equipment: "gym" as const,
  training_days_per_week: 4,
  session_duration_minutes: 60,
  active_title_tier_id: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
}

vi.mock("@/hooks/useUserProfile", () => ({
  useUserProfile: () => ({
    data: mockProfile,
    isLoading: false,
    isError: false,
  }),
}))

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    auth: { signOut: vi.fn().mockResolvedValue({}) },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: "" } })),
        list: vi.fn(() => ({ data: [] })),
        remove: vi.fn(),
      })),
    },
  },
}))

vi.mock("@/lib/avatarUpload", () => ({
  assertAvatarFile: vi.fn(),
  uploadUserAvatar: vi.fn(),
  removeUserAvatarFiles: vi.fn(),
}))

const TEST_USER = { id: "uid-1", email: "test@example.com" } as unknown as User

function renderPage() {
  const result = renderWithProviders(<AccountPage />)
  result.store.set(authAtom, TEST_USER)
  result.store.set(weightUnitAtom, "kg")
  return result
}

// --- tests ---

describe("AccountPage — danger zone", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDeleteMutateAsync.mockResolvedValue(undefined)
    mockUpdateMutateAsync.mockResolvedValue(mockProfile)
  })

  it("renders the danger zone section", () => {
    renderPage()
    expect(screen.getByText("Danger zone")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /delete my account/i })).toBeInTheDocument()
  })

  it("opens the confirmation dialog when the delete button is clicked", async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole("button", { name: /delete my account/i }))

    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    expect(screen.getByText("Delete your account?")).toBeInTheDocument()
  })

  it("confirm button is disabled until DELETE is typed exactly", async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole("button", { name: /delete my account/i }))

    const confirmBtn = screen.getByRole("button", { name: /yes, delete my account/i })
    expect(confirmBtn).toBeDisabled()

    const input = screen.getByPlaceholderText("DELETE")
    await user.type(input, "DELET")
    expect(confirmBtn).toBeDisabled()

    await user.type(input, "E")
    expect(confirmBtn).not.toBeDisabled()
  })

  it("typing wrong case keeps confirm disabled", async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole("button", { name: /delete my account/i }))

    const input = screen.getByPlaceholderText("DELETE")
    await user.type(input, "delete")

    expect(screen.getByRole("button", { name: /yes, delete my account/i })).toBeDisabled()
  })

  it("calls deleteAccount mutation when confirmed", async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole("button", { name: /delete my account/i }))
    await user.type(screen.getByPlaceholderText("DELETE"), "DELETE")
    await user.click(screen.getByRole("button", { name: /yes, delete my account/i }))

    await waitFor(() => {
      expect(mockDeleteMutateAsync).toHaveBeenCalledTimes(1)
    })
  })

  it("resets the input when the dialog is cancelled", async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole("button", { name: /delete my account/i }))
    await user.type(screen.getByPlaceholderText("DELETE"), "DELETE")
    await user.click(screen.getByRole("button", { name: /cancel/i }))

    // Re-open dialog — input should be empty
    await user.click(screen.getByRole("button", { name: /delete my account/i }))
    expect(screen.getByPlaceholderText("DELETE")).toHaveValue("")
  })
})
