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
} from "@/store/atoms"
import { useUserProfile } from "@/hooks/useUserProfile"
import { useBadgeStatus } from "@/hooks/useBadgeStatus"
import { renderWithProviders } from "@/test/utils"
import { SideDrawer } from "./SideDrawer"

const { mockSignOut } = vi.hoisted(() => ({
  mockSignOut: vi.fn().mockResolvedValue({}),
}))

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signOut: mockSignOut,
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(),
    },
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

describe("SideDrawer library navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("exposes Programs and Exercises links under Library", async () => {
    renderDrawer()
    const dialog = await screen.findByRole("dialog")
    const programs = within(dialog).getByRole("link", { name: /^Programs$/i })
    const exercises = within(dialog).getByRole("link", { name: /^Exercises$/i })
    expect(programs).toHaveAttribute("href", "/library/programs")
    expect(exercises).toHaveAttribute("href", "/library/exercises")
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
    vi.mocked(useUserProfile).mockReturnValue({
      data: { active_title_tier_id: "tier-42" },
    } as ReturnType<typeof useUserProfile>)
    vi.mocked(useBadgeStatus).mockReturnValue({
      data: [
        {
          tier_id: "tier-42",
          rank: "gold",
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
      ],
    } as ReturnType<typeof useBadgeStatus>)

    renderDrawer()
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Iron Warrior")).toBeInTheDocument()
  })

  it("does not show title line when no title is equipped", async () => {
    vi.mocked(useUserProfile).mockReturnValue({ data: null } as ReturnType<typeof useUserProfile>)
    vi.mocked(useBadgeStatus).mockReturnValue({ data: [] } as ReturnType<typeof useBadgeStatus>)

    renderDrawer()
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).queryByText("Iron Warrior")).not.toBeInTheDocument()
  })
})
