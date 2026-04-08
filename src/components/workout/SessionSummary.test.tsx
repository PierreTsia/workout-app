import { describe, it, expect, vi } from "vitest"
import { screen, act } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { sessionAtom } from "@/store/atoms"
import { SessionSummary } from "./SessionSummary"

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(),
    },
  },
}))

vi.mock("@/hooks/useExerciseFromLibrary", () => ({
  useExerciseFromLibrary: () => ({ data: null }),
}))

vi.mock("@/components/achievements/SessionBadges", () => ({
  SessionBadges: () => null,
}))

vi.mock("@/components/generator/SaveAsProgramPrompt", () => ({
  SaveAsProgramPrompt: () => null,
}))

const BASE_PROPS = {
  setsDone: 9,
  exercisesCompleted: 3,
  totalExercises: 3,
  prExercises: [] as { exerciseId: string; name: string; emoji: string }[],
  onNewSession: vi.fn(),
}

describe("SessionSummary", () => {
  it("renders exercise count from props", () => {
    renderWithProviders(<SessionSummary {...BASE_PROPS} />)
    expect(screen.getByText("3 / 3")).toBeInTheDocument()
  })

  it("renders sets done from props", () => {
    renderWithProviders(<SessionSummary {...BASE_PROPS} />)
    expect(screen.getByText("9")).toBeInTheDocument()
  })

  it("updates displayed count when different props are provided on re-render", () => {
    // This test documents that SessionSummary is fully prop-driven: it renders
    // whatever exercisesCompleted/totalExercises it receives. This is precisely why
    // WorkoutPage.tsx captures a frozen snapshot (finishedStats) at handleFinish()
    // time — so that post-finish state drift (preSessionPatch reset, query
    // invalidation) cannot change the values passed to this component.
    const { rerender } = renderWithProviders(
      <SessionSummary {...BASE_PROPS} exercisesCompleted={3} totalExercises={3} />,
    )

    expect(screen.getByText("3 / 3")).toBeInTheDocument()

    // Simulate the race condition that the fix prevents: after handleFinish(),
    // exercises can change (e.g. preSessionPatch reset drops added rows), which
    // WITHOUT the snapshot fix would propagate zeroed-out values here.
    rerender(<SessionSummary {...BASE_PROPS} exercisesCompleted={0} totalExercises={0} />)

    // The component reflects the new props — confirming it is fully prop-driven,
    // and that passing frozen (correct) props is the right fix.
    expect(screen.getByText("0 / 0")).toBeInTheDocument()
  })

  it("shows zero / zero when session had no exercises", () => {
    renderWithProviders(
      <SessionSummary
        {...BASE_PROPS}
        setsDone={0}
        exercisesCompleted={0}
        totalExercises={0}
      />,
    )
    expect(screen.getByText("0 / 0")).toBeInTheDocument()
  })

  it("renders PR badges for provided prExercises", () => {
    const prExercises = [
      { exerciseId: "ex-1", name: "Bench Press", emoji: "🏋️" },
    ]
    renderWithProviders(
      <SessionSummary {...BASE_PROPS} prExercises={prExercises} />,
    )
    expect(screen.getByText("Bench Press")).toBeInTheDocument()
  })

  it("uses session startedAt to compute duration", () => {
    const { store } = renderWithProviders(
      <SessionSummary {...BASE_PROPS} />,
    )

    // When startedAt is null, duration shows a dash placeholder
    expect(screen.getByText("—")).toBeInTheDocument()

    // Set a valid startedAt on the session atom
    act(() => {
      store.set(sessionAtom, (prev) => ({
        ...prev,
        startedAt: Date.now() - 5 * 60 * 1000, // 5 minutes ago
        isActive: false,
      }))
    })

    // After startedAt is set, a formatted duration should replace the dash
    expect(screen.queryByText("—")).not.toBeInTheDocument()
  })
})
