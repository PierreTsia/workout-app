import { afterEach, describe, expect, it, vi } from "vitest"
import { act, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { HeroBlock } from "@/components/profile/HeroBlock"
import { ProfileWindowProvider } from "@/components/profile/ProfileWindowContext"
import { authAtom } from "@/store/atoms"
import type { SessionFact } from "@/lib/profile/types"
import type { UserProfile } from "@/types/onboarding"

const BENCH = { exerciseId: "bench", name: "Bench Press", emoji: "🏋️" }
const OVERHEAD = { exerciseId: "ohp", name: "Overhead Press", emoji: "💪" }

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}))

type ProfileMock = Pick<
  UserProfile,
  | "user_id"
  | "display_name"
  | "avatar_url"
  | "session_duration_minutes"
  | "created_at"
  | "active_title_tier_id"
>

const loadedProfile = (): ProfileMock => ({
  user_id: "user-1",
  display_name: "Ada",
  avatar_url: null,
  session_duration_minutes: 60,
  created_at: "2023-01-01T00:00:00.000Z",
  active_title_tier_id: null,
})

const profileState = vi.hoisted(() => ({
  isPending: false,
  data: {
    user_id: "user-1",
    display_name: "Ada" as string | null,
    avatar_url: null as string | null,
    session_duration_minutes: 60,
    created_at: "2023-01-01T00:00:00.000Z",
    active_title_tier_id: null as string | null,
  },
}))

vi.mock("@/hooks/useUserProfile", () => ({
  useUserProfile: () => ({
    data: profileState.data,
    isPending: profileState.isPending,
    isLoading: profileState.isPending,
    isError: false,
  }),
}))

vi.mock("@/hooks/useFirstFinishedSessionAt", () => ({
  useFirstFinishedSessionAt: () => ({
    data: "2026-08-01T08:00:00.000Z",
    isPending: false,
    isError: false,
    isSuccess: true,
  }),
}))

vi.mock("@/hooks/useActiveProgram", () => ({
  useActiveProgram: () => ({
    data: { id: "upper-lower", name: "Upper/Lower" },
    isPending: false,
    isError: false,
  }),
}))

vi.mock("@/hooks/useUserPrograms", () => ({
  useUserPrograms: () => ({
    data: [
      { id: "upper-lower", name: "Upper/Lower" },
      { id: "ppl", name: "PPL" },
    ],
    isPending: false,
    isError: false,
  }),
}))

vi.mock("@/hooks/useBadgeStatus", () => ({
  useBadgeStatus: () => ({
    data: [],
    isPending: false,
    isError: false,
    isSuccess: true,
  }),
}))

vi.mock("@/hooks/useProgramExercisePreview", () => ({
  useProgramExercisePreview: (programId: string) => ({
    data: programId === "ppl" ? [OVERHEAD] : [BENCH],
    isPending: false,
    isError: false,
  }),
}))

vi.mock("@/lib/trainingActivityTimezone", () => ({
  getResolvedIANATimeZone: () => "UTC",
}))

function session(overrides: Partial<SessionFact>): SessionFact {
  return {
    id: "s1",
    started_at: "2026-08-20T10:00:00.000Z",
    finished_at: "2026-08-20T11:00:00.000Z",
    active_duration_ms: 40 * 60_000,
    program_id: "upper-lower",
    has_catalog_circuit: false,
    ...overrides,
  }
}

vi.mock("@/hooks/useProfileSnapshot", () => ({
  useProfileLiveQueries: () => ({
    snapshotQuery: {
      data: {
        sessions: [
          session({ id: "ul", program_id: "upper-lower" }),
          session({
            id: "ppl",
            program_id: "ppl",
            finished_at: "2026-08-18T11:00:00.000Z",
          }),
        ],
        sets: [],
      },
    },
    rollupsQuery: { data: null },
    boundedKind: "7" as const,
    liveBounded: true,
    liveAll: false,
  }),
}))

const GOOGLE_PHOTO = "https://lh3.google/photo.png"
const CUSTOM_PHOTO = "https://cdn.example/ada.png"

function googleAuthUser() {
  return {
    id: "user-1",
    email: "ada@example.com",
    user_metadata: {
      avatar_url: GOOGLE_PHOTO,
      full_name: "Ada Google",
    },
  }
}

function renderHero() {
  const result = renderWithProviders(
    <ProfileWindowProvider kind="7" setKind={() => {}}>
      <HeroBlock mode="pierre" />
    </ProfileWindowProvider>,
  )
  act(() => {
    result.store.set(authAtom, googleAuthUser() as never)
  })
  return result
}

describe("HeroBlock program badge popover", () => {
  afterEach(() => {
    vi.useRealTimers()
    profileState.isPending = false
    profileState.data = loadedProfile()
  })

  it("opens the active program popover with an exercise and a builder link", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 7, 21))
    const user = userEvent.setup()
    renderHero()

    await waitFor(() => {
      expect(screen.getByText("Active · Upper/Lower")).toBeInTheDocument()
    })

    await user.click(screen.getByText("Active · Upper/Lower"))

    expect(await screen.findByText(/Bench Press/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open program" })).toHaveAttribute(
      "href",
      "/builder/upper-lower",
    )
  })

  it("opens the hop program popover with an exercise and a builder link", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 7, 21))
    const user = userEvent.setup()
    renderHero()

    await waitFor(() => {
      expect(screen.getByText("Also PPL · Last 7 days")).toBeInTheDocument()
    })

    await user.click(screen.getByText("Also PPL · Last 7 days"))

    expect(await screen.findByText(/Overhead Press/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open program" })).toHaveAttribute(
      "href",
      "/builder/ppl",
    )
  })

  it("keeps fixture badges static when there is no program id", async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <ProfileWindowProvider kind="7" setKind={() => {}}>
        <HeroBlock mode="pierre" />
      </ProfileWindowProvider>,
    )

    const badge = screen.getByText("Active · Upper/Lower")
    await user.click(badge)

    expect(screen.queryByRole("link", { name: "Open program" })).not.toBeInTheDocument()
    expect(screen.queryByText("Bench Press")).not.toBeInTheDocument()
  })
})

describe("HeroBlock GymLogic identity", () => {
  afterEach(() => {
    profileState.isPending = false
    profileState.data = loadedProfile()
  })

  it("skeletons the avatar and handle until the GymLogic profile query settles", () => {
    profileState.isPending = true
    profileState.data = { ...loadedProfile(), display_name: null, avatar_url: null }
    renderHero()

    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(
      0,
    )
    expect(screen.queryByText("ada@example.com")).not.toBeInTheDocument()
    expect(screen.queryByText("Ada Google")).not.toBeInTheDocument()
    expect(document.querySelector(`img[src="${GOOGLE_PHOTO}"]`)).toBeNull()
    expect(screen.queryByText("Ada")).not.toBeInTheDocument()
  })

  it("renders the GymLogic handle and custom avatar after the profile query settles", () => {
    profileState.data = {
      ...profileState.data,
      display_name: "Ada",
      avatar_url: CUSTOM_PHOTO,
    }
    renderHero()

    expect(screen.getByRole("region", { name: "Ada" })).toBeInTheDocument()
    expect(screen.queryByText("ada@example.com")).not.toBeInTheDocument()
    expect(screen.queryByText("Ada Google")).not.toBeInTheDocument()
    expect(document.querySelector(`img[src="${GOOGLE_PHOTO}"]`)).toBeNull()
    expect(document.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(0)
  })
})
