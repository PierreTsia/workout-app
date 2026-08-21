import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { ProfileChartsPlaygroundPage } from "./ProfileChartsPlaygroundPage"
import {
  restoreChartLayout,
  stubChartLayout,
} from "@/components/profile/charts/chartTestLayout"

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }))

describe("ProfileChartsPlaygroundPage", () => {
  beforeEach(() => {
    stubChartLayout()
  })

  afterEach(() => {
    restoreChartLayout()
  })

  it("shows Mix, Records combo, and radar fixtures in one view", async () => {
    renderWithProviders(<ProfileChartsPlaygroundPage />)

    expect(
      screen.getByRole("heading", { name: "Profile chart atoms" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Mix" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Records" })).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Équilibre" }),
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByRole("img", { name: "Mix" })).toBeInTheDocument()
      expect(
        screen.getByRole("img", { name: "PRs and RIR 0 rate" }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole("img", { name: "Muscle balance" }),
      ).toBeInTheDocument()
    })
  })
})

const routerSources = import.meta.glob("../router/index.tsx", {
  query: "?raw",
  eager: true,
  import: "default",
})

describe("/_profile-charts", () => {
  it("is nested under AdminGuard, not the public AppShell routes", () => {
    const [routerSource] = Object.values(routerSources)
    if (typeof routerSource !== "string") {
      throw new Error("expected router source")
    }

    expect(routerSource).toMatch(
      /element: <AdminGuard \/>[\s\S]*path: "\/_profile-charts"/,
    )
    expect(routerSource).not.toMatch(
      /path: "\/_profile-charts"[\s\S]*element: <AdminGuard \/>/,
    )
  })
})
