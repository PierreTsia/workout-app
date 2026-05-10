/**
 * Wiring tests for `QuickWorkoutSheet` (T128, #342).
 *
 * Scope: lock in the routing decision between the new
 * `useCommitQuickWorkout` (AI-sourced live workouts → MCP) and the
 * existing `useCreateQuickWorkout` (deterministic + draft → raw insert).
 * The shape of either hook is tested elsewhere — here we only care that
 * the sheet picks the right one based on `generationSource`.
 *
 * Strategy: stub the child step components so we can fire each terminal
 * action (Start / Save) deterministically without going through the AI
 * generation network call or the constraint UI.
 */

import { vi, describe, it, expect, beforeEach } from "vitest"
import { screen, fireEvent } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import type { ComponentProps } from "react"
import { QuickWorkoutSheet } from "./QuickWorkoutSheet"
import type { GeneratedWorkout } from "@/types/generator"

const mockCommitMutate = vi.fn()
const mockCreateMutate = vi.fn()

vi.mock("@/hooks/useCommitQuickWorkout", () => ({
  useCommitQuickWorkout: () => ({
    mutate: mockCommitMutate,
    isPending: false,
  }),
}))

vi.mock("@/hooks/useCreateQuickWorkout", () => ({
  useCreateQuickWorkout: () => ({
    mutate: mockCreateMutate,
    isPending: false,
  }),
}))

vi.mock("@/hooks/useExercisesForGenerator", () => ({
  useExercisesForGenerator: () => ({ data: [], isLoading: false }),
}))

const FAKE_WORKOUT: GeneratedWorkout = {
  name: "AI Workout",
  hasFallback: false,
  exercises: [
    {
      exercise: {
        id: "11111111-1111-1111-1111-111111111111",
        name: "Bench Press",
        name_en: "Bench Press",
        emoji: "💪",
        muscle_group: "chest",
        equipment: "barbell",
        image_url: null,
        difficulty_level: "intermediate",
        is_system: true,
        measurement_type: "reps",
        default_duration_seconds: null,
        secondary_muscles: [],
      },
      sets: 3,
      reps: "10",
      restSeconds: 90,
      isCompound: false,
    },
  ],
}

// Stub the AI generating step: render a "trigger AI success" button so
// tests can deterministically push the sheet into preview-with-ai-source
// state without the network call.
vi.mock("./QuickWorkoutAIGeneratingStep", () => ({
  QuickWorkoutAIGeneratingStep: (props: {
    onSuccess: (w: GeneratedWorkout) => void
  }) => (
    <button onClick={() => props.onSuccess(FAKE_WORKOUT)}>
      trigger-ai-success
    </button>
  ),
}))

// Stub the constraint step: render buttons that fire onAIGenerate vs
// onGenerate so each entry path is reachable from the test.
vi.mock("./ConstraintStep", () => ({
  ConstraintStep: (props: {
    onAIGenerate: () => void
    onGenerate: () => void
  }) => (
    <>
      <button onClick={props.onAIGenerate}>trigger-ai-generate</button>
      <button onClick={props.onGenerate}>trigger-quick-generate</button>
    </>
  ),
}))

// Stub the preview step: render Start / Save buttons so we can fire each
// terminal action without rendering the full preview UI.
vi.mock("./PreviewStep", () => ({
  PreviewStep: (props: {
    workout: GeneratedWorkout
    onStart: (w: GeneratedWorkout) => void
    onSave: (w: GeneratedWorkout) => void
  }) => (
    <>
      <button onClick={() => props.onStart(props.workout)}>preview-start</button>
      <button onClick={() => props.onSave(props.workout)}>preview-save</button>
    </>
  ),
}))

function renderSheet(extra: Partial<ComponentProps<typeof QuickWorkoutSheet>> = {}) {
  const onStart = vi.fn()
  const onOpenChange = vi.fn()
  const utils = renderWithProviders(
    <QuickWorkoutSheet
      open={true}
      onOpenChange={onOpenChange}
      onStart={onStart}
      {...extra}
    />,
  )
  return { ...utils, onStart, onOpenChange }
}

describe("QuickWorkoutSheet — generationSource routing", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("AI-sourced Start uses the new MCP commit hook (not the legacy raw-insert hook)", () => {
    renderSheet()

    fireEvent.click(screen.getByText("trigger-ai-generate"))
    fireEvent.click(screen.getByText("trigger-ai-success"))
    fireEvent.click(screen.getByText("preview-start"))

    expect(mockCommitMutate).toHaveBeenCalledTimes(1)
    expect(mockCreateMutate).not.toHaveBeenCalled()
    const [args] = mockCommitMutate.mock.calls[0] as [{ workout: GeneratedWorkout }]
    expect(args.workout).toEqual(FAKE_WORKOUT)
  })

  it("deterministic-sourced Start uses the legacy raw-insert hook", () => {
    renderSheet()

    fireEvent.click(screen.getByText("trigger-quick-generate"))
    fireEvent.click(screen.getByText("preview-start"))

    expect(mockCreateMutate).toHaveBeenCalledTimes(1)
    expect(mockCommitMutate).not.toHaveBeenCalled()
  })

  it("Save (draft) always uses the legacy raw-insert hook regardless of source", () => {
    // MCP create_workout_day has no `saved_at` semantics today — drafts
    // stay on the raw-insert path until the data model gets a real
    // draft concept. AI-source + Save must NOT route through commit.
    renderSheet()

    fireEvent.click(screen.getByText("trigger-ai-generate"))
    fireEvent.click(screen.getByText("trigger-ai-success"))
    fireEvent.click(screen.getByText("preview-save"))

    expect(mockCreateMutate).toHaveBeenCalledTimes(1)
    expect(mockCreateMutate.mock.calls[0][0]).toMatchObject({ saveAsDraft: true })
    expect(mockCommitMutate).not.toHaveBeenCalled()
  })
})
