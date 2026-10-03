import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders, mockQueryResult } from "@/test/utils"
import { AdminReviewPage } from "@/pages/AdminReviewPage"
import {
  useExercisesForReview,
  useReviewTotalCount,
} from "@/hooks/useExercisesForReview"
import type { ExerciseWithUsage } from "@/hooks/useExercisesForReview"

vi.mock("@/hooks/useExercisesForReview", () => ({
  useExercisesForReview: vi.fn(),
  useReviewTotalCount: vi.fn(),
  REVIEW_QUEUE_KEY: "exercises-for-review",
}))
vi.mock("@/hooks/useAdminUpdateExercise", () => ({
  useAdminUpdateExercise: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock("@/hooks/useCatalogLabels", () => ({
  useCatalogLabels: () => ({
    muscleLabel: (value: string | null | undefined) => value ?? "",
    equipmentLabel: (value: string | null | undefined) => value ?? "",
  }),
}))
vi.mock("@/components/admin/exercise-form/ExerciseEditForm", () => ({
  ExerciseEditForm: () => <div />,
}))
vi.mock("@/components/admin/review/ExerciseReviewToolbar", () => ({
  ExerciseReviewToolbar: () => <div />,
}))

const exercise: ExerciseWithUsage = {
  id: "bench",
  name: "Développé couché",
  name_en: "Bench Press",
  muscle_group: "Pectoraux",
  equipment: "barbell",
  emoji: "🏋️",
  is_system: true,
  created_at: "",
  youtube_url: null,
  instructions: null,
  image_url: null,
  difficulty_level: null,
  source: null,
  secondary_muscles: null,
  reviewed_at: null,
  reviewed_by: null,
  usage_count: 12,
}

const mockedQueue = vi.mocked(useExercisesForReview)
const mockedTotalCount = vi.mocked(useReviewTotalCount)

beforeEach(() => {
  vi.clearAllMocks()
  mockedQueue.mockReturnValue(mockQueryResult([exercise]))
  mockedTotalCount.mockReturnValue(mockQueryResult(5))
})

// The bar is the only progress indicator on the page: without a label the
// core's ProgressBar carries no accessible name.
describe("AdminReviewPage", () => {
  it("names the progress bar for assistive tech", () => {
    renderWithProviders(<AdminReviewPage />)

    expect(
      screen.getByRole("progressbar", { name: "Review progress" }),
    ).toBeInTheDocument()
  })
})
