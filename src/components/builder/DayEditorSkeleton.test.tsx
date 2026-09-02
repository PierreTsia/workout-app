import { describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { DayEditorSkeleton } from "./DayEditorSkeleton"

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }))

describe("DayEditorSkeleton", () => {
  it("announces loading", () => {
    renderWithProviders(<DayEditorSkeleton />)

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument()
  })
})
