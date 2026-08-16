import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { BenchmarkStoryHeader } from "./BenchmarkStoryHeader"
import type { BenchmarkCopy } from "@/hooks/useBenchmarkCompletionHistory"

const CINDY_COPY: BenchmarkCopy = {
  slug: "cindy",
  tagline_fr: "Le WOD de Tom Holland. 20 min.",
  tagline_en: "Tom Holland’s WOD. 20 min.",
  story_fr:
    "Cinq tractions, dix pompes, quinze squats. Autant de tours que possible. Le score s’écrit 27+3, pas en kilos. Holland a posé 27 tours — à toi de voir.",
  story_en:
    "Five pull-ups, ten push-ups, fifteen squats. As many rounds as possible. The score is 27+3, not kilos. Holland did 27 rounds — your move.",
  reference: { name: "Tom Holland", score: "27" },
}

describe("BenchmarkStoryHeader", () => {
  it("renders Holland as editorial copy, never as a run row", () => {
    renderWithProviders(<BenchmarkStoryHeader copy={CINDY_COPY} />)

    expect(screen.getByText("Tom Holland’s WOD. 20 min.")).toBeInTheDocument()
    expect(
      screen.getByText(/Five pull-ups, ten push-ups, fifteen squats/),
    ).toBeInTheDocument()
    expect(screen.getByText(/Tom Holland — 27 rounds/)).toBeInTheDocument()
    expect(screen.queryByText("PB")).not.toBeInTheDocument()
    expect(screen.queryByText(/vs last/)).not.toBeInTheDocument()
    expect(screen.queryByRole("list")).not.toBeInTheDocument()
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument()
  })

  it("picks tagline and story from the Display Locale", () => {
    renderWithProviders(<BenchmarkStoryHeader copy={CINDY_COPY} />, {
      locale: "fr",
    })

    expect(screen.getByText("Le WOD de Tom Holland. 20 min.")).toBeInTheDocument()
    expect(screen.getByText(/Cinq tractions, dix pompes, quinze squats/)).toBeInTheDocument()
    expect(screen.getByText(/Tom Holland — 27 tours/)).toBeInTheDocument()
    expect(screen.queryByText("Tom Holland’s WOD. 20 min.")).not.toBeInTheDocument()
  })
})
