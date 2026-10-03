import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders, mockQueryResult } from "@/test/utils"
import { AdminEnrichmentPage } from "@/pages/AdminEnrichmentPage"
import {
  useExercisesNeedingImages,
  useExerciseTotalCount,
} from "@/hooks/useExercisesNeedingImages"
import type { Exercise } from "@/types/database"

vi.mock("@/hooks/useExercisesNeedingImages", () => ({
  useExercisesNeedingImages: vi.fn(),
  useExerciseTotalCount: vi.fn(),
}))
vi.mock("@/components/admin/enrichment/EnrichmentCard", () => ({
  EnrichmentCard: () => <div />,
}))

const exercise = (id: string): Exercise => ({
  id,
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
})

const mockedNeedingImages = vi.mocked(useExercisesNeedingImages)
const mockedTotalCount = vi.mocked(useExerciseTotalCount)

beforeEach(() => {
  vi.clearAllMocks()
  mockedNeedingImages.mockReturnValue(mockQueryResult([exercise("bench")]))
  mockedTotalCount.mockReturnValue(mockQueryResult(4))
})

// The bar is the only progress indicator on the page: without a label the
// core's ProgressBar carries no accessible name.
describe("AdminEnrichmentPage", () => {
  it("names the progress bar for assistive tech", () => {
    renderWithProviders(<AdminEnrichmentPage />)

    expect(
      screen.getByRole("progressbar", { name: "Image progress" }),
    ).toBeInTheDocument()
  })
})
