import { describe, expect, it, vi, beforeEach } from "vitest"
import { act, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  authAtom,
  drawerOpenAtom,
  localeAtom,
  sessionAtom,
  defaultSessionState,
  queueSyncMetaAtom,
  isAdminAtom,
} from "@/store/atoms"
import { useUserProfile } from "@/hooks/useUserProfile"
import { useBadgeStatus } from "@/hooks/useBadgeStatus"
import { renderWithProviders, mockQueryResult } from "@/test/utils"
import { SideDrawer } from "./SideDrawer"

const { mockSignOut, mockEq, mockUpdate } = vi.hoisted(() => {
  const mockEq = vi.fn().mockResolvedValue({ error: null })
  return {
    mockSignOut: vi.fn().mockResolvedValue({}),
    mockEq,
    mockUpdate: vi.fn(() => ({ eq: mockEq })),
  }
})

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signOut: mockSignOut,
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(),
    },
    from: vi.fn(() => ({ update: mockUpdate })),
  },
  clearUserState: vi.fn(),
}))

vi.mock("@/hooks/useUserProfile", () => ({
  useUserProfile: vi.fn(() => ({ data: null })),
}))

vi.mock("@/hooks/useBadgeStatus", () => ({
  useBadgeStatus: vi.fn(() => ({ data: [] })),
}))

vi.mock("@/hooks/useInstallPrompt", () => ({
  useInstallPrompt: () => ({ canInstall: false, promptInstall: vi.fn() }),
}))

vi.mock("@/lib/platform", () => ({
  isIOS: () => false,
  isStandalone: () => false,
}))

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "dark", setTheme: vi.fn() }),
}))

const testUser = {
  id: "user-1",
  email: "test@example.com",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: "2024-01-01",
} as import("@supabase/supabase-js").User

function renderDrawer(
  atomOverrides: {
    isActive?: boolean
    pendingCount?: number
  } = {},
) {
  const { isActive = false, pendingCount = 0 } = atomOverrides
  const result = renderWithProviders(<SideDrawer />)
  const { store } = result

  act(() => {
    store.set(localeAtom, "en")
    store.set(authAtom, testUser)
    store.set(queueSyncMetaAtom, { pendingCount })
    store.set(sessionAtom, {
      ...defaultSessionState,
      ...(isActive && {
        isActive: true,
        startedAt: Date.now(),
        currentDayId: "day-1",
      }),
    })
    store.set(drawerOpenAtom, true)
  })

  return result
}

describe("SideDrawer Profil nav", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows Profile next to History for an admin", async () => {
    const { store } = renderDrawer()
    act(() => {
      store.set(isAdminAtom, true)
    })
    const dialog = await screen.findByRole("dialog")
    const profile = within(dialog).getByRole("link", { name: /^Profile$/i })
    const history = within(dialog).getByRole("link", { name: /^History$/i })
    expect(profile).toHaveAttribute("href", "/profile")
    expect(
      profile.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it("hides Profile for a non-admin", async () => {
    renderDrawer()
    const dialog = await screen.findByRole("dialog")
    expect(
      within(dialog).queryByRole("link", { name: /^Profile$/i }),
    ).not.toBeInTheDocument()
    expect(
      within(dialog).getByRole("link", { name: /^History$/i }),
    ).toBeInTheDocument()
  })
})

describe("SideDrawer library navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("exposes Programs, Exercises, and Circuits links under Library", async () => {
    renderDrawer()
    const dialog = await screen.findByRole("dialog")
    const programs = within(dialog).getByRole("link", { name: /^Programs$/i })
    const exercises = within(dialog).getByRole("link", { name: /^Exercises$/i })
    const circuits = within(dialog).getByRole("link", { name: /^Circuits$/i })
    expect(programs).toHaveAttribute("href", "/library/programs")
    expect(exercises).toHaveAttribute("href", "/library/exercises")
    expect(circuits).toHaveAttribute("href", "/library/circuits")
  })
})

describe("SideDrawer sign-out guard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("signs out directly when no active session and no pending sync", async () => {
    const user = userEvent.setup()
    renderDrawer()

    const dialog = await screen.findByRole("dialog")
    const signOutButton = within(dialog).getByText("Sign out")
    await user.click(signOutButton)

    expect(mockSignOut).toHaveBeenCalledOnce()
  })

  it("shows confirm dialog when session is active", async () => {
    const user = userEvent.setup()
    renderDrawer({ isActive: true })

    const dialog = await screen.findByRole("dialog")
    const signOutButton = within(dialog).getByText("Sign out")
    await user.click(signOutButton)

    expect(mockSignOut).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.getByText("Workout in progress")).toBeInTheDocument()
    })
  })

  it("shows unsaved data dialog when there are pending sync items", async () => {
    const user = userEvent.setup()
    renderDrawer({ pendingCount: 2 })

    const dialog = await screen.findByRole("dialog")
    const signOutButton = within(dialog).getByText("Sign out")
    await user.click(signOutButton)

    expect(mockSignOut).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.getByText("Unsaved workout data")).toBeInTheDocument()
    })
  })

  it("signs out after confirming the active-session dialog", async () => {
    const user = userEvent.setup()
    renderDrawer({ isActive: true })

    const sheetDialog = await screen.findByRole("dialog")
    const signOutBtn = within(sheetDialog).getByText("Sign out")
    await user.click(signOutBtn)

    await waitFor(() => {
      expect(screen.getByText("Workout in progress")).toBeInTheDocument()
    })

    const allDialogs = screen.getAllByRole("dialog")
    const confirmDialog = allDialogs.find((d) => d !== sheetDialog)!
    const confirmButton = within(confirmDialog).getByText("Sign out")
    await user.click(confirmButton)

    expect(mockSignOut).toHaveBeenCalledOnce()
  })
})

describe("SideDrawer achievements", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders Achievements nav item linking to /achievements", async () => {
    renderDrawer()
    const dialog = await screen.findByRole("dialog")
    const link = within(dialog).getByRole("link", { name: /Achievements/i })
    expect(link).toHaveAttribute("href", "/achievements")
  })

  it("shows equipped title under display name when active_title_tier_id is set", async () => {
    vi.mocked(useUserProfile).mockReturnValue(
      mockQueryResult({
        user_id: "user-1",
        display_name: null,
        avatar_url: null,
        age: 30,
        weight_kg: 80,
        gender: "male" as const,
        goal: "strength" as const,
        experience: "intermediate" as const,
        equipment: "gym" as const,
        training_days_per_week: 4,
        session_duration_minutes: 60,
        active_title_tier_id: "tier-42",
        timezone: "Europe/Paris",
        locale: null,
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      }),
    )
    vi.mocked(useBadgeStatus).mockReturnValue(
      mockQueryResult([
        {
          tier_id: "tier-42",
          rank: "gold" as const,
          title_en: "Iron Warrior",
          title_fr: "Guerrier de fer",
          group_slug: "volume_king",
          group_id: "g1",
          group_name_en: "Volume",
          group_name_fr: "Volume",
          tier_level: 3,
          threshold_value: 50000,
          icon_asset_url: null,
          is_unlocked: true,
          granted_at: "2026-01-01",
          current_value: 60000,
          progress_pct: 100,
        },
      ]),
    )

    renderDrawer()
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Iron Warrior")).toBeInTheDocument()
  })

  it("does not show title line when no title is equipped", async () => {
    vi.mocked(useUserProfile).mockReturnValue(mockQueryResult(null))
    vi.mocked(useBadgeStatus).mockReturnValue(mockQueryResult([]))

    renderDrawer()
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).queryByText("Iron Warrior")).not.toBeInTheDocument()
  })
})

describe("SideDrawer language switch", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEq.mockResolvedValue({ error: null })
    localStorage.clear()
  })

  it("switches the UI and syncs the choice to the profile", async () => {
    const user = userEvent.setup()
    renderDrawer()

    await user.click(screen.getByRole("button", { name: "FR" }))

    // localStorage is what the next boot reads, so it has to win locally...
    await waitFor(() => {
      expect(localStorage.getItem("locale")).toBe('"fr"')
    })
    // ...and the profile only carries the choice to the user's other devices.
    expect(mockUpdate).toHaveBeenCalledWith({ locale: "fr" })
    expect(mockEq).toHaveBeenCalledWith("user_id", "user-1")
  })

  // The switch has already taken effect locally when the write goes out, so a
  // failure has nothing to tell the user.
  it("keeps the UI switched when the profile write fails", async () => {
    mockEq.mockRejectedValue(new Error("offline"))
    const user = userEvent.setup()
    renderDrawer()

    await user.click(screen.getByRole("button", { name: "FR" }))

    await waitFor(() => {
      expect(localStorage.getItem("locale")).toBe('"fr"')
    })
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
