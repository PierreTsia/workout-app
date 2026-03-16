import { describe, it, expect, vi } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { PreviewExerciseCard } from "./PreviewExerciseCard"
import type { GeneratedExercise } from "@/types/generator"
import type { Exercise } from "@/types/database"

function fakeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: "bench-press",
    name: "Bench Press",
    muscle_group: "Pectoraux",
    emoji: "🏋️",
    is_system: true,
    created_at: "",
    youtube_url: null,
    instructions: null,
    image_url: null,
    equipment: "barbell",
    difficulty_level: null,
    name_en: null,
    source: null,
    secondary_muscles: ["Triceps"],
    reviewed_at: null,
    reviewed_by: null,
    ...overrides,
  }
}

function makeItem(overrides: Partial<GeneratedExercise> = {}): GeneratedExercise {
  return {
    exercise: fakeExercise(),
    sets: 3,
    reps: "10",
    restSeconds: 90,
    isCompound: true,
    ...overrides,
  }
}

function setup(item = makeItem()) {
  const onRemove = vi.fn()
  const onSwap = vi.fn()
  const onInfo = vi.fn()
  const onUpdateSets = vi.fn()
  const onUpdateReps = vi.fn()

  const result = renderWithProviders(
    <PreviewExerciseCard
      item={item}
      index={0}
      onRemove={onRemove}
      onSwap={onSwap}
      onInfo={onInfo}
      onUpdateSets={onUpdateSets}
      onUpdateReps={onUpdateReps}
    />,
  )

  return { ...result, onRemove, onSwap, onInfo, onUpdateSets, onUpdateReps }
}

describe("PreviewExerciseCard", () => {
  it("renders exercise name, muscle group, and sets×reps", () => {
    setup()
    expect(screen.getByText("Bench Press")).toBeInTheDocument()
    expect(screen.getByText("Pectoraux")).toBeInTheDocument()
    expect(screen.getByText("3 × 10")).toBeInTheDocument()
  })

  it("shows compound label for compound exercises", () => {
    setup(makeItem({ isCompound: true }))
    expect(screen.getByText("Compound")).toBeInTheDocument()
  })

  it("shows isolation label for isolation exercises", () => {
    setup(makeItem({ isCompound: false }))
    expect(screen.getByText("Isolation")).toBeInTheDocument()
  })

  it("shows rest seconds", () => {
    setup()
    expect(screen.getByText(/90s/)).toBeInTheDocument()
  })

  it("calls onInfo when exercise name is clicked", async () => {
    const user = userEvent.setup()
    const { onInfo } = setup()
    await user.click(screen.getByText("Bench Press"))
    expect(onInfo).toHaveBeenCalledWith(0)
  })

  it("calls onInfo when emoji is clicked", async () => {
    const user = userEvent.setup()
    const { onInfo } = setup()
    await user.click(screen.getByText("🏋️"))
    expect(onInfo).toHaveBeenCalledWith(0)
  })

  it("decrements sets on minus click", async () => {
    const user = userEvent.setup()
    const { onUpdateSets } = setup()
    await user.click(screen.getByText("−"))
    expect(onUpdateSets).toHaveBeenCalledWith(0, 2)
  })

  it("does not decrement sets below 1", async () => {
    const user = userEvent.setup()
    const { onUpdateSets } = setup(makeItem({ sets: 1 }))
    await user.click(screen.getByText("−"))
    expect(onUpdateSets).toHaveBeenCalledWith(0, 1)
  })

  it("increments sets on plus click", async () => {
    const user = userEvent.setup()
    const { onUpdateSets } = setup()
    await user.click(screen.getByText("+"))
    expect(onUpdateSets).toHaveBeenCalledWith(0, 4)
  })

  it("cycles reps on Reps button click", async () => {
    const user = userEvent.setup()
    const { onUpdateReps } = setup(makeItem({ reps: "10" }))
    await user.click(screen.getByText("Reps"))
    expect(onUpdateReps).toHaveBeenCalledWith(0, "12")
  })

  it("wraps reps cycle from 20 back to 6", async () => {
    const user = userEvent.setup()
    const { onUpdateReps } = setup(makeItem({ reps: "20" }))
    await user.click(screen.getByText("Reps"))
    expect(onUpdateReps).toHaveBeenCalledWith(0, "6")
  })
})
